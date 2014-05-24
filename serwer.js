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

var history = []; // historia chatu

var redis = require("redis"),
    client = redis.createClient()

var userzy = [];
var flaga = false;

// Konfiguracja passport.js
passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});
-
passport.use(new LocalStrategy(
    function (username, password, done) {
        console.log("Sprawdzam usera " + username);

        client.get(username, function (err, reply) {
            if(reply !== null && reply.toString() === password){
                console.log("user OK");
                var d = new Date();
                userzy.push(username);
                client.rpush("LOG", username + ": " + d, function (err, reply) {
                    console.log("Zapis w logach");
                });

                return done(null, {
                username: username,
                password: password
            });
            }
            else{
                console.log("Spierdalaj");
                flaga = false;
                return done(null, false);
            }
        });
    }
));

app.use(express.cookieParser());
app.use(express.urlencoded());
app.use(express.session({
    store: sessionStore,
    key: sessionKey,
    secret: sessionSecret
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));

app.get('/', function (req, res) {
    var body = '<html><body>';
    var username;
    if (req.user) {
        username = req.user.username;
        body += '<p>Jesteś zalogowany jako „' + username + '”</p>';
        body += '<a href="/logout">Wyloguj</a>'
    } else {
        body += '<a href="/login">Zaloguj</a>'
    }
    body += '</body></html>'
    res.send(body);
});

app.get('/login', function (req, res) {
    /*
    var body = '<html><body>'
    body += '<form action="/login" method="post">';
    body += '<div><label>Użytkownik:</label>';
    body += '<input type="text" name="username"/><br/></div>';
    body += '<div><label>Hasło:</label>';
    body += '<input type="password" name="password"/></div>';
    body += '<div><input type="submit" value="Zaloguj"/></div></form>';
    body += '</body></html>'
    res.send(body);
    */
    res.redirect('/login.html');
});

app.post('/login',
    passport.authenticate('local', {
        failureRedirect: '/login'
    }),
    function (req, res) {
        res.redirect('/index.html');
    }
);

app.get('/logout', function (req, res) {
    console.log('Wylogowanie...')
    flaga = false;
    req.logout();
    res.redirect('/login');
});

server = http.createServer(app);
sio = socketIo.listen(server);

var onAuthorizeSuccess = function (data, accept) {
    console.log('Udane połączenie z socket.io');
    accept(null, true);
};

var onAuthorizeFail = function (data, message, error, accept) {
    if (error) {
        throw new Error(message);
    }
    console.log('Nieudane połączenie z socket.io:', message);
    accept(null, false);
};

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

sio.sockets.on('connection', function (socket) {
    var myId = id;
    id++;
    
    socket.emit('username', userzy[myId]);
    socket.emit('history', history);

    socket.on('reply', function (data) {
        console.log(data);
    });

    /** 
    * Chat
    */
    socket.on('send msg', function (data, id) {
        var m = userzy[myId] + ": " + data;
        console.log(m);
        history.unshift(m);
        sio.sockets.emit('rec msg', m);
    });
});

server.listen(3000, function () {
    console.log('Serwer pod adresem http://localhost:3000/');
});
