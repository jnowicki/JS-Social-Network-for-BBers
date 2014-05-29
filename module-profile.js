module.exports = function() {
    var express = require('express');
    var app = express();

    app.get('/:id', function(req, res) {
        var body = '<html><body>';
        res.body = '<p>' + req.params.id.toString(); + '</p>';
        body += '</body></html>';
        res.send(body);
    });

    return app;
}();