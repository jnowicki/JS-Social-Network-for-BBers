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
var fs = require('fs');

var userzy = []; // lista aktualnie zalogowanych userow
var popularnoscUserow = {};
var wszyscyUserzyWRedisie = [];
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
            client.setnx(username, password, function(err, reply) {
                console.log(reply.toString());
            });

            res.redirect('/login.html?b=1');
        } else {
            res.redirect('/signup.html');
        }
    });

//utworzenie klasy PROFIL (waga,tluszcz itp) w redisie i powiazanie z klasa username,password
app.post('/edit', function(req, res) {

    //wybranie dzisiejszej daty
    ////////
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1; //January is 0!
    var yyyy = today.getFullYear();

    if (dd < 10) {
        dd = '0' + dd
    }

    if (mm < 10) {
        mm = '0' + mm
    }

    today = dd + '/' + mm + '/' + yyyy;
    ///////////////////

    var waga = req.body.waga;
    var tluszcz = req.body.tluszcz;
    var bicek = req.body.bicek;
    var wzrost = req.body.wzrost;
    var imie = req.body.imie;
    var nazwisko = req.body.nazwisko;
    var miasto = req.body.miasto;
    var dataUtw = today;
    var username = req.user.username;

    //// wyciagnij id ktorzy trzeba przyporzadkowac profilowi
    /*
    client.get('userCount', function(err, reply) {
        userData = JSON.parse(reply);
        profiles.push(userData);
        sio.sockets.emit('appendProfile', userData);
    });
    */

    var data = {
        waga: waga,
        tluszcz: tluszcz,
        bicek: bicek,
        username: username,
        wzrost: wzrost,
        imie: imie,
        nazwisko: nazwisko,
        miasto: miasto,
        dataUtw: dataUtw,
    };



    fs.readFile(req.files.image.path, function(err, data) {

        var imageName = req.files.image.name

        /// If there's an error
        if (!imageName) {

            console.log("There was an error")
            res.redirect("/");
            res.end();

        } else {
            console.log("ZAPISUJE FOTE" + imageName);
            var newPath = __dirname + "/public/uploads/" + username + ".jpg";
            console.log(newPath);

            /// write file to uploads/ folder
            fs.writeFile(newPath, data, function(err) {

                /// let's see it


            });
        }
    });



    var jsondata = JSON.stringify(data)
    ///// ustaw w redisie zmienna posiadajace informacjen a temat profili
    client.set(username + "data", jsondata, function(err, reply) {
        console.log(reply.toString());
    });
    //// dodaj do listy istniejacych profili dodany profil
    client.rpush('profiles', username);

    //// zwieksz licznik userow ktorzy utworzyli swoje profile
    client.incr('userCount');

    //// rozeslij nowy profil do uzytkownikow
    sio.sockets.emit('appendProfile', data)

    res.redirect('/')
});

app.post('/login',
    passport.authenticate('local', {
        failureRedirect: '/login.html?b=-1'
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

app.get('/createNew', function(req, res) {
    console.log('Wylogowanie...')
    req.logout();
    res.redirect('/signup.html');
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


var getProfiles = function(socket) {
    client.lrange('profiles', 0, -1, function(err, items) {
        if (err) throw err;
        //var profiles = [];
        items.forEach(function(item, i) {
            var userData = "";

            client.get(item + "data", function(err, reply) {
                userData = JSON.parse(reply);
                //profiles.push(userData);
                socket.emit('appendProfile', userData);
            });
        });
    });
}


var getAllLubiane = function() {
    popularnoscUserow = {};
    wszyscyUserzyWRedisie.forEach(function(user) {
        popularnoscUserow[user] = 0; // konieczna inicjalizacja
    });
    for (var i = 0; i < wszyscyUserzyWRedisie.length; i++) {
        console.log("teraz sprawdzam lubianych przez" + wszyscyUserzyWRedisie[i]);
        client.lrange(wszyscyUserzyWRedisie[i] + 'lubiane', 0, -1, function(err, items) {
            if (err) throw err;
            items.forEach(function(item) {
                console.log(wszyscyUserzyWRedisie[i] + 'zwieksza popularnosc ' + item);
                popularnoscUserow[item]++;
                console.log(item + " ma teraz " + popularnoscUserow[item] + "punkty popularnosci");
            });

            //////// uwaga niestabilna funckja, moze wywolywac sie o duzo razy za duzo przy duzych ilosiach lajkow ; )
            sio.sockets.emit('popularnosc', popularnoscUserow);


        });
    }

};

var getAllUserzy = function() {
    wszyscyUserzyWRedisie = [];
    client.lrange('profiles', 0, -1, function(err, items) {
        if (err) throw err;
        //var profiles = [];
        items.forEach(function(item) {
            console.log(" mam cie " + item)
            wszyscyUserzyWRedisie.push(item);
        });
        getAllLubiane();
    });
};

getAllUserzy();

var getLubiane = function(socket, user) {
    client.lrange(user + 'lubiane', 0, -1, function(err, items) {
        if (err) throw err;
        socket.emit("uaktualnijLubiane", items)
    })
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

    /// rozeslij userowi profile
    getProfiles(socket);
    /// rozeslij userowi jego lubiane
    getLubiane(socket, userzy[myId]);

    //// rozeslij userom ich username i liste zalogowanych aktualnie userow
    if (userzy[myId]) {
        socket.emit('username', userzy[myId]); // dodatkowo wykona emit ask for data w main.js
        sio.sockets.emit('zalogowaniUserzy', userzy);
        socket.emit('popularnosc', popularnoscUserow);
        console.log("wyslalem emita o userach");
    } else {
        socket.emit('oknoLogowania'); // przekieruj na okno logowania jak odswiezasz strone
    }

    socket.on('disconnect', function() {
        console.log('nastapil disconnect usera o id:' + myId + ', name: ' + userzy[myId]);

        id--;
        userzy.splice(myId, 1); // kasowanie usera

        /// DO KONSOLI logow
        var listaUserow = "pozostali jeszcze: ";
        userzy.forEach(function(usr, index) {
            listaUserow += index + "." + usr + " ";
        });
        if (listaUserow.length > 21) console.log(listaUserow);
        /////
        sio.sockets.emit('zalogowaniUserzy', userzy);
        socket.emit('oknoLogowania');
    });

    socket.on('usunProfil', function(user) {
        console.log('Usuwam ' + user);
        client.del(user);
        client.del(user + 'data');
        client.decr('userCount');
        client.lrem('profiles', 0, user);
        socket.disconnect();
    })

    socket.on('askForData', function(user) {
        console.log("ask for data by " + user)
        var replyobj;
        client.get(user + "data", function(err, reply) {

            replyobj = JSON.parse(reply);

            if (user.length > 1 && replyobj)
                socket.emit('updateData', replyobj);
        });
    });
    /////// Obsługa treningów
    /////////////////////////

    /////// Kiedy dostaniesz od klienta zapytanie o treningi, to wyslij mu te treningi z edisa
    socket.on('zapytanieOTreningi', function(user) {
        console.log("ask for treningi for " + user.username + "treningi");
        client.lrange(user.username + 'treningi', 0, -1, function(err, items) {
            if (err) throw err;
            var lista = [];
            for (var i = 0; i < items.length; i++) {
                var parsedItem = JSON.parse(items[i]);
                lista.push(parsedItem);
            }
            socket.emit('zwrotTreningow', lista, user);

        });
        client.lrange(user.username + 'diety', 0, -1, function(err, items) {
            if (err) throw err;
            var lista = [];
            for (var i = 0; i < items.length; i++) {
                var parsedItem = JSON.parse(items[i]);
                lista.push(parsedItem);
            }
            socket.emit('zwrotDiet', lista, user);

        });
    });

    socket.on('zapytanieOLubiane', function(user) {
        client.lrange(user.username + 'lubiane', 0, -1, function(err, items) {
            if (err) throw err;
            console.log('wysylam uaktualnienie lubianych: ' + items + ' usera: ' + user.username);
            socket.emit("uaktulnijLubianePodgladanego", items);
        })
    });

    /////// kiedy klient doda jakis trening to dodaj ten trening do bazy na jego konto treningowe w redisie
    socket.on('dodajTrening', function(trening, user) {
        var jsontrening = JSON.stringify(trening);
        client.rpush(user + 'treningi', jsontrening);
        console.log("dodalem trening do " + user + " o zawartosci " + jsontrening);
    });

    socket.on('dodajDiete', function(dieta, user) {
        var jsondieta = JSON.stringify(dieta);
        client.rpush(user + 'diety', jsondieta);
        console.log("dodalem diete do " + user + " o zawartosci " + jsondieta);
    });

    socket.on('edytujProfil', function(data, user) {
        var jsondata = JSON.stringify(data);
        client.set(user + 'data', jsondata);
        console.log("zmieniłem dla " + user + " data na " + jsondata);
    });

    socket.on('usunTrening', function(trening, user) {
        var jsontrening = JSON.stringify(trening);
        client.lrem(user + 'treningi', 0, jsontrening, function(err, reply) {
            console.log(reply.toString);
        });
    });

    socket.on('usunDiete', function(dieta, user) {
        var jsondieta = JSON.stringify(dieta);
        client.lrem(user + 'diety', 0, jsondieta, function(err, reply) {
            console.log(reply.toString);
        });
    });

    /////////////////////////////
    /////////////////////////////


    socket.on('polubProfil', function(profil, user) {
        client.rpush(user + 'lubiane', profil.username, function(err, reply) {

        });
        getAllUserzy();
    });

    socket.on('odlubProfil', function(profil, user) {
        console.log("dostaje request o skasowanie z " + user + "lubiane, profil: " + profil.username);
        client.lrem(user + 'lubiane', 0, profil.username);
        getAllUserzy();
    })
});

server.listen(3000, function() {
    console.log('Serwer pod adresem http://localhost:3000/');
});