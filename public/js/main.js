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



        socket.on('connect', function() {
            $scope.connected = true;
            $scope.$digest();
        });
        /// tego nie uzywam
        socket.on('profiles', function(data) {
            $scope.profiles = data;
            $scope.$digest();
        });
        /// tego tak naprawde uzywam
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