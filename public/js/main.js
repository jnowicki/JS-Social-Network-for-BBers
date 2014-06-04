var app = angular.module('serwis', []);

app.factory('socket', function() {
    var socket = io.connect('http://' + location.host);
    return socket;
});

app.controller('serwisCtrlr', ['$scope', 'socket',
    function($scope, socket) {

        $scope.connected = false;
        $scope.user = "";
        $scope.userData = {};
        $scope.profiles = [];
        $scope.treningi = [];
        $scope.zalogowaniUserzy = [];

        $scope.pokazPanelDodaniaTreningu = false;
        $scope.pokazPanelTreningow = false;
        $scope.podgladanyProfil = {};
        $scope.lubianeProfile = [];
        $scope.lubianePodgladanego = "";

        ////kolorowanie różnic miedzy podgladanym profilem a userem zalogowanym
        $scope.wzrostKolor = "gray";
        $scope.wagaKolor = "gray";
        $scope.bicekKolor = "gray";
        /////



        $scope.wyswietlPanelDodaniaTreningu = function() {
            $scope.pokazPanelTreningow = false;
            $scope.pokazPanelDodaniaTreningu = true;

        }

        $scope.dodajTrening = function() {
            socket.emit('dodajTrening', $scope.nowyTrening, $scope.user);
            $scope.nowyTrening = {};
            $scope.pokazPanelDodaniaTreningu = false;
        }
        ////////// dostan ten trneing na ktory spojrzysz
        $scope.getTrening = function(user) {
            $scope.treningi = [];
            socket.emit('zapytanieOLubiane', user);
            socket.emit('zapytanieOTreningi', user);
        }



        $scope.wyswietlStatus = function(user) {
            var zalogowany = false;
            for (var i = 0; i < $scope.zalogowaniUserzy.length; i++) {
                if ($scope.zalogowaniUserzy[i] === user) {
                    zalogowany = true;
                    break;
                }
            }
            if (zalogowany) {
                return "zalogowany";
            }
        }

        $scope.usunProfil = function() {
            socket.emit("usunProfil", $scope.user)
            socket.disconnect();
            window.location = '/login.html';
        }

        $scope.wyloguj = function() {
            socket.disconnect();
            window.location = '/login.html';
        }

        $scope.lubieTo = function() {
            $scope.lubianeProfile.push($scope.podgladanyProfil.username);
            socket.emit("polubProfil", $scope.podgladanyProfil, $scope.user);
        }

        $scope.nieLubieTo = function() {
            var czyJest;
            $scope.lubianeProfile.forEach(function(username, i) {
                console.log("iteruje... mam teraz " + i + "." + username)
                if (username === $scope.podgladanyProfil.username) {
                    console.log("TAk! kasuje " + $scope.lubianeProfile[i]);
                    $scope.lubianeProfile.splice(i, 1);

                }
            });
            console.log("emituje podgladanyprofil do skasowania na server")
            socket.emit("odlubProfil", $scope.podgladanyProfil, $scope.user);
        }


        $scope.czyProfilNieJestWLubianych = function() {
            if ($scope.podgladanyProfil.username === $scope.user) {
                return false;
            } else {
                var czyLubiany = false;
                $scope.lubianeProfile.forEach(function(item) {
                    if (item === $scope.podgladanyProfil.username) czyLubiany = true;
                });
                if (czyLubiany) return false;
                return true;
            }
        }

        socket.on('uaktualnijLubiane', function(lubiane) {
            $scope.lubianeProfile = lubiane;
            $scope.$digest();
        });

        socket.on('uaktulnijLubianePodgladanego', function(lubianeLista) {
            console.log(lubianeLista);
            var lubianeStr = "";
            lubianeLista.forEach(function(item) {
                lubianeStr += item + ", ";
            });
            $scope.lubianePodgladanego = lubianeStr.substring(0, lubianeStr.length - 2);
            $scope.$digest();
        })
        ////////// kiedy dostaniesz z servera zwrot treningow to go dodaj
        socket.on('zwrotTreningow', function(treningi, user) {
            $scope.podgladanyProfil = user;
            //// kod zwiazany z kolorowaniem roznic miedzy podgladanym profilem a aktualnym uzytkownikiem
            //////////
            $scope.wzrostKolor = "gray";
            $scope.wagaKolor = "gray";
            $scope.bicekKolor = "gray";
            if ($scope.podgladanyProfil.wzrost - $scope.userData.wzrost > 0) {
                $scope.wzrostKolor = "red";
            } else if ($scope.podgladanyProfil.wzrost - $scope.userData.wzrost < 0) {
                $scope.wzrostKolor = "green";
            }
            if ($scope.podgladanyProfil.waga - $scope.userData.waga > 0) {
                $scope.wagaKolor = "red";
            } else if ($scope.podgladanyProfil.waga - $scope.userData.waga < 0) {
                $scope.wagaKolor = "green";
            }
            if ($scope.podgladanyProfil.bicek - $scope.userData.bicek > 0) {
                $scope.bicekKolor = "red";
            } else if ($scope.podgladanyProfil.bicek - $scope.userData.bicek < 0) {
                $scope.bicekKolor = "green";
            }
            ///////////////////
            ///////////////////

            $scope.treningi = treningi;
            $scope.pokazPanelTreningow = true;
            $scope.pokazPanelDodaniaTreningu = false;

            $scope.$digest();
        })

        socket.on('connect', function() {
            $scope.connected = true;
            $scope.$digest();
        });

        /// tego tak naprawde uzywam
        socket.on('appendProfile', function(data) {
            if (data.username !== $scope.user) {
                $scope.profiles.push(data);

            }
            $scope.$digest();
        });

        socket.on('username', function(data) {
            $scope.user = data;
            socket.emit('askForData', data);
            $scope.$digest();
        });

        socket.on('updateData', function(data) {
            $scope.userData = data;
            $scope.$digest();
        });

        socket.on('zalogowaniUserzy', function(userzy) {
            $scope.zalogowaniUserzy = userzy;
            console.log("dostalem " + userzy);
            $scope.$digest();
        });

        //przekieruj na okno logowania - odswiezanie
        socket.on('oknoLogowania', function() {
            window.location = '/login.html';
        });
    }
]);