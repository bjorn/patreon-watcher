var http = require("http");
var https = require("https");

var status = {
    earnings: 0,
    patrons: 0,
    updated: "Never",
};

http.createServer(function (request, response) {
    response.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    response.end(JSON.stringify(status));
}).listen(80);

console.log('Server running at http://127.0.0.1:80/');

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
            var json = JSON.parse(body);

            status.earnings = json.linked[0].pledge_sum / 100;
            status.patrons = json.linked[0].patron_count;
            status.updated = new Date().toUTCString();
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
