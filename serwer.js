var http = require('http');
var express = require('express');
var app = express();
var connect = require('connect');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var socketIo = require('socket.io');
var passportSocketIo = require('passport.socketio');
var sessionStore = new connect.session.MemoryStore();
var sessionSecret = 'wielkiSekret44';
var sessionKey = 'connect.sid';
var server;
var sio;

var id = 0;

var redis = require("redis"),
    client = redis.createClient();

var userzy = []; // lista aktualnie zalogowanych userow
var profiles = [];

// Konfiguracja passport.js
passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});
passport.use(new LocalStrategy(
    function(username, password, done) {
        console.log("Sprawdzam usera " + username);

        var zalogowany = false;

        for (var i in userzy) {
            if (userzy[i] === username) {
                zalogowany = true;
                console.log("juz zalogowany");
            }
        }
        if (zalogowany) {
            return done(null, false);
        } else {
            client.get(username, function(err, reply) {
                if (reply !== null && reply.toString() === password) {
                    console.log("user OK");
                    var d = new Date();
                    userzy.push(username);
                    client.rpush("LOG", username + ": " + d, function(err, reply) {
                        console.log("Zapis w logach");
                    });

                    return done(null, {
                        username: username,
                        password: password
                    });
                } else {
                    console.log("EE");
                    flaga = false;
                    return done(null, false);
                }
            });
        }
    }
));

app.use(express.cookieParser());
app.use(express.json());
app.use(express.multipart());
app.use(express.urlencoded());
app.use(express.session({
    store: sessionStore,
    key: sessionKey,
    secret: sessionSecret
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));
app.use('/profiles/', require('./module-profile'));

app.get('/', function(req, res) {
    if (req.user) {
        res.redirect('/mainpage.html');
    } else {
        res.redirect('/login.html');
    }
});

app.get('/mainpage', function(req, res) {
    if (req.user) {
        res.redirect('/mainpage.html');
    } else {
        res.redirect('/login.html');
    }
});


//utworzenie klasy username,password w redisie, przekierowanie na edycje profilu
app.post('/signup',
    function(req, res) {
        var username = req.body.username;
        var password = req.body.password;
        var confirmation = req.body.confirmation;

        if (password === confirmation) {
            client.set(username, password, function(err, reply) {
                console.log(reply.toString());
            });

            res.redirect('/login.html');
        } else {
            res.redirect('/signup.html');
        }
    });

//utworzenie klasy PROFIL (waga,tluszcz itp) w redisie i powiazanie z klasa username,password
app.post('/edit', function(req, res) {
    var waga = req.body.waga;
    var tluszcz = req.body.tluszcz;
    var bicek = req.body.bicek;
    var username = req.user.username;

    var data = {
        waga: waga,
        tluszcz: tluszcz,
        bicek: bicek,
        username: username
    };

    var jsondata = JSON.stringify(data)
    client.set(username + "data", jsondata, function(err, reply) {
        console.log(reply.toString());
    });
    client.rpush('profiles', username);

    res.redirect('/')
});

app.post('/login',
    passport.authenticate('local', {
        failureRedirect: '/login'
    }),
    function(req, res) {
        //sprawdzanie czy istnieje dla usera dane na temat jego profilu , jesli nie to przekieruj na panel dodawania informacji
        client.keys('*', function(err, keys) {
            if (err) return console.log(err);
            if (keys.indexOf(req.user.username + "data") > -1) {
                res.redirect('/');
            } else {
                res.redirect('/edit.html');
            }
        })
    }
);

app.get('/logout', function(req, res) {
    console.log('Wylogowanie...')
    req.logout();
    res.redirect('/login.html');
});

var onAuthorizeSuccess = function(data, accept) {
    console.log('Udane połączenie z socket.io');
    accept(null, true);
};

var onAuthorizeFail = function(data, message, error, accept) {
    if (error) {
        throw new Error(message);
    }
    console.log('Nieudane połączenie z socket.io:', message);
    accept(null, false);
};

server = http.createServer(app);
sio = socketIo.listen(server);


var getProfiles = function() {
    client.lrange('profiles', 0, -1, function(err, items) {
        if (err) throw err;
        var profiles = [];
        items.forEach(function(item, i) {
            var userData = "";

            client.get(item + "data", function(err, reply) {
                userData = JSON.parse(reply);
                profiles.push(userData);
                sio.sockets.emit('appendProfile', userData);
            });
        });
    });
}

sio.set('authorization', passportSocketIo.authorize({
    passport: passport,
    cookieParser: express.cookieParser,
    key: sessionKey, // nazwa ciasteczka, w którym express/connect przechowuje identyfikator sesji
    secret: sessionSecret,
    store: sessionStore,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail
}));

sio.set('log level', 2); // 3 == DEBUG, 2 == INFO, 1 == WARN, 0 == ERROR

sio.sockets.on('connection', function(socket) {
    var myId = id;
    id++;
    console.log("Połączenie, id: " + myId + " user: " + userzy[myId]);

    //socket.emit('profiles', profiles);

    getProfiles();

    if (userzy[myId]) {
        socket.emit('username', userzy[myId]); // dodatkowo wykona emit ask for data w main.js
    } else {
        socket.emit('oknoLogowania');
    }

    socket.on('disconnect', function() {
        console.log('nastapil disconnect usera o id:' + myId + ', name: ' + userzy[myId]);

        var listaUserow = "pozostali jeszcze: ";
        id--;
        userzy.splice(myId, 1); // kasowanie usera
        userzy.forEach(function(usr, index) {
            listaUserow += index + "." + usr + " ";
        });
        if (listaUserow.length > 21) console.log(listaUserow);

        socket.emit('wyloguj');
    });

    socket.on('askForData', function(user) {
        console.log("ask for data by " + user)
        var replyobj;
        client.get(user + "data", function(err, reply) {

            replyobj = JSON.parse(reply);

            if (user.length > 1 && replyobj)
                socket.emit('updateData', replyobj);
        });
    });
});

server.listen(3000, function() {
    console.log('Serwer pod adresem http://localhost:3000/');
});