var http = require("http");
var https = require("https");
var url = require('url');

var port = 80;

var refreshTimeout = null;

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
        if (!refreshTimeout) {
            refreshStatus();
            response.writeHead(200);
            response.end('Refreshing');

            // Don't refresh for ten seconds
            refreshTimeout = setTimeout(function() { refreshTimeout = null }, 10 * 1000)
        } else {
            response.writeHead(200);
            response.end('Ignored');
        }
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

function findObject(included, data) {
    for (i = 0; i < included.length; ++i) {
        var object = included[i]
        if (object.type == data.type && object.id == data.id) {
            return object;
        }
    }
    return null;
}

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

                var campaign = findObject(json.included, json.data.relationships.campaign.data)
                var secondGoal = findObject(json.included, campaign.relationships.goals.data[1])

                status.earnings = campaign.attributes.pledge_sum / 100;
                status.patrons = campaign.attributes.patron_count;
                status.next_goal = secondGoal.attributes.amount / 100;
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
