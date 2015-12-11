var http = require("http");
var https = require("https");
var url = require('url');

var port = 80;

var status = {
    earnings: 0,
    patrons: 0,
    updated: "Never",
};

http.createServer(function (request, response) {
    var pathname = url.parse(request.url).pathname;

    if (pathname == '/on_create' ||
        pathname == '/on_update' ||
        pathname == '/on_delete')
    {
        // A pledge was created, updated or deleted
        refreshStatus();
        response.writeHead(200);
        response.end('OK');
    }
    else if (pathname == '/')
    {
        response.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        response.end(JSON.stringify(status));
    }
    else
    {
        response.writeHead(404);
        response.end();
    }
}).listen(port);

console.log('Server running at http://127.0.0.1:' + port + '/');

function refreshStatus() {
    var options = {
        hostname: "api.patreon.com",
        path: "/user/90066",
        rejectUnauthorized: false,
        agent: false,
    };

    var req = https.request(options, function(res) {
        var body = ""

        res.on("data", function(chunk) { body += chunk; });

        res.on("end", function() {
            try {
                var json = JSON.parse(body);

                status.earnings = json.linked[0].pledge_sum / 100;
                status.patrons = json.linked[0].patron_count;
                status.updated = new Date().toUTCString();
            } catch (err) {
                console.log(err);
            }
        });
    });

    req.on("error", function(e) {
        console.log("problem with request: " + e.message);
    });

    req.end();
}

// refresh status every 5 minutes (288 times a day)
setInterval(refreshStatus, 1000 * 60 * 5);
refreshStatus();
