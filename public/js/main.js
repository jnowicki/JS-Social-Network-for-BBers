var app = angular.module('serwis', []);

app.factory('socket', function() {
    var socket = io.connect('http://' + location.host);
    return socket;
});

app.controller('chatCtrlr', ['$scope', 'socket',
    function($scope, socket) {

        var tagsToReplace = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;'
        };
        var replaceTag = function(tag) {
            return tagsToReplace[tag] || tag;
        };
        var safe_tags_replace = function(str) {
            return str.replace(/[&<>]/g, replaceTag);
        };
        $scope.connected = false;
        $scope.user = "";
        $scope.userData = {};
        $scope.profiles = [];

        $scope.wyswietlProfile = function() {
            var cialo = "";

            $scope.profiles.forEach(function(pro) {
                cialo += "<ul class='nav nav-sidebar'>";
                cialo += "<li><b>" + pro.username + "</b></li>";
                cialo += "<li>" + pro.waga + "</li>";
                cialo += "<li>" + pro.tluszcz + "</li>";
                cialo += "<li>" + pro.bicek + "</li>";
                cialo += "</ul>";
            });
            $('#profile').append(cialo);
        }

        socket.on('connect', function() {
            $scope.connected = true;
            $scope.$digest();
        });

        socket.on('profiles', function(data) {
            $scope.profiles = data;
            $scope.$digest();
        });

        socket.on('appendProfile', function(data) {
            $scope.profiles.push(data);
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