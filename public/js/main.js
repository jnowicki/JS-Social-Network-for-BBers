var app = angular.module('serwis', []);

app.factory('socket', function () {
    var socket = io.connect('http://' + location.host);
    return socket;
});

app.controller('chatCtrlr', ['$scope', 'socket',
    function ($scope, socket) {

        var tagsToReplace = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;'
        };
        var replaceTag = function (tag) {
            return tagsToReplace[tag] || tag;
        };
        var safe_tags_replace = function (str) {
            return str.replace(/[&<>]/g, replaceTag);
        };
        $scope.msgs = [];
        $scope.connected = false;
        $scope.zmienNikus = false;
        $scope.nik = "";
        $scope.user = "";
        $scope.dupa = false;

        $scope.sendMsg = function () {
            if ($scope.msg && $scope.msg.text) {
                socket.emit('send msg', safe_tags_replace($scope.msg.text.substring(0, 20)));
                $scope.msg.text = '';
            }
        };

        $scope.wyswietlNik = function () {
                return '*** ' + $scope.user +  ' ***';
        };

        socket.on('connect', function () {
            $scope.connected = true;
            $scope.$digest();
        });

        socket.on('history', function (data) {
            $scope.msgs = data;
            $scope.$digest();
        });

        socket.on('username', function (data) {
            $scope.user = data;
            $scope.$digest();
        });


        socket.on('rec msg', function (data) {
            $scope.msgs.unshift(data);
            $scope.$digest();
        });
    }
]);