var app = angular.module('czatApka', []);

app.factory('socket', function() {
    var socket = io.connect('http://' + location.host);
    return socket;
});

app.controller('chatCtrlr', ['$scope', 'socket',
    function($scope, socket) {

        $('#gra').hide();
        $('#panelAutor').hide();
        $('#panelOpis').hide();
        $('#gotowosc').attr("disabled", "disabled");
        $scope.msgs = [];
        $scope.user = "";
        $scope.userzy = {};


        $scope.sendMsg = function() {

            if ($scope.msg && $scope.msg.text) {
                socket.emit('send msg', $scope.msg.text);
                $scope.msg.text = '';
            }
        };

        $scope.wyswietlNik = function() {
            return $scope.user;
        };

        socket.on('history', function(data) {
            $scope.msgs = data;
            $scope.$digest();
        });

        socket.on('username', function(data) {
            $scope.user = data;
            $scope.$digest();
        });

        socket.on('gracze', function(data) {
            $scope.userzy = data;
            console.log(data);
            $('tbody').empty();
            var iterator = 1;

            console.log(data);
            for (var i in data) {
                $('tbody').append("<tr><td>" + iterator + "</td><td>" + data[i].name + "</td><td>postac</td></tr>");
                iterator++;
            }

            $scope.$digest();
        });

        // kiedy okreslona liczba graczy bedzie, przycisk jest dostepny
        socket.on('guzikStart', function(data) {
            if (data === 1) {
                $('#gotowosc').removeAttr("disabled");
            } else {
                $('#gotowosc').attr("disabled", "disabled");
            }
            $scope.$digest();
        });

        //po nacisnieciu start wysyłanie info do servera
        $('#gotowosc').click(function() {
            socket.emit('gotowy');

        });
        //czekanie az wszyscy portwierdza
        socket.on('czekanie', function(ilosc) {
            $('#panelGotowosci').append("<p> Czekamy na " + ilosc + "graczy </p>");
        })

        //start gry po potwierdzeniu gotowowości przez wszystkich graczy
        socket.on('startGry', function() {
            $('#panelGotowosci').empty();
            $('#gra').show();
        })


        socket.on('rec msg', function(data) {
            $scope.msgs.unshift(data);
            $scope.$digest();
        });

        //wylogowanie po odświeżaniu
        socket.on('wylogowanie', function() {
            window.location = '/login.html';

        });

        //przyciski Menu
        $('#autorMenu').click(function() {
            czyscMenu();
            $('#autorMenu').addClass("active");
            $('#panelAutor').show();
        });

        $('#graMenu').click(function() {
            czyscMenu();
            $('#graMenu').addClass("active");
            $('#panelGra').show();

        });
        $('#opisMenu').click(function() {
            czyscMenu();
            $('#opisMenu').addClass("active");
            $('#panelOpis').show();
        });

        function czyscMenu() {
            $('#panelGra').hide();
            $('#panelOpis').hide();
            $('#panelAutor').hide();
            $('#autorMenu').removeClass();
            $('#opisMenu').removeClass();
            $('#graMenu').removeClass();
        }
    }
]);