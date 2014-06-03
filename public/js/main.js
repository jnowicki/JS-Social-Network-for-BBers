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

        $scope.pokazPanelDodaniaTreningu = false;
        $scope.pokazPanelTreningow = false;
        $scope.podgladanyProfil = "";


        $scope.wyswietlPanelDodaniaTreningu = function() {
            $scope.pokazPanelTreningow = false;
            $scope.pokazPanelDodaniaTreningu = true;

        }

        $scope.dodajTrening = function() {
            socket.emit('dodajTrening', $scope.nowyTrening, $scope.user);
            console.log($scope.nowyTrening.nazwa);
            $scope.nowyTrening = {};
            $scope.pokazPanelDodaniaTreningu = false;
        }
        ////////// dostan ten trneing na ktory spojrzysz
        $scope.getTrening = function(user) {
            console.log("getTrening od " + user);
            $scope.treningi = [];
            socket.emit('zapytanieOTreningi', user);
        }
        ////////// kiedy dostaniesz z servera zwrot treningow to go dodaj
        socket.on('zwrotTreningow', function(treningi, user) {
            $scope.treningi = treningi;
            $scope.pokazPanelTreningow = true;
            $scope.pokazPanelDodaniaTreningu = false;
            $scope.podgladanyProfil = user;
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

        //przekieruj na okno logowania - odswiezanie
        socket.on('oknoLogowania', function() {
            window.location = '/login.html';
        });
    }
]);