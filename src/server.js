var http = require("http");
var https = require("https");
var url = require('url');

var port = 80;

var refreshTimeout = null;

var status = {
    earnings: 0,
    patrons: 0,
    updated: "Never",
    liberapayEarnings_Tiled: 0,
    liberapayPatrons_Tiled: 0,
    liberapayUpdated_Tiled: "Never",
    liberapayEarnings_bjorn: 0,
    liberapayPatrons_bjorn: 0,
    liberapayUpdated_bjorn: "Never"
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
        response.end(JSON.stringify(status, null, 2));
    }
    else
    {
        response.writeHead(404);
        response.end();
    }
}).listen(port);

console.log('Server running at http://127.0.0.1:' + port + '/');

function findObject(included, data) {
    for (var i = 0; i < included.length; ++i) {
        var object = included[i]
        if (object.type == data.type && object.id == data.id) {
            return object;
        }
    }
    return null;
}

function refreshPatreonStatus() {
    // https://api.patreon.com/user/90066
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

                var goals = campaign.relationships.goals.data;
                var nextGoal = null;

                for (var i = 0; i < goals.length; ++i) {
                    var goal = findObject(json.included, goals[i])
                    if (goal.attributes.completed_percentage < 100) {
                        nextGoal = goal;
                        break;
                    }
                }

                status.earnings = campaign.attributes.pledge_sum / 100;
                status.patrons = campaign.attributes.patron_count;
                if (nextGoal)
                    status.next_goal = nextGoal.attributes.amount_cents / 100;
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

function refreshLiberapayStatus(account) {
    // https://liberapay.com/Tiled/public.json
    var options = {
        hostname: "liberapay.com",
        path: "/" + account + "/public.json",
        rejectUnauthorized: false,
        agent: false,
    };

    var req = https.request(options, function(res) {
        var body = ""

        res.on("data", function(chunk) { body += chunk; });

        res.on("end", function() {
            try {
                var json = JSON.parse(body);

                status["liberapayEarnings_" + account] = json.receiving.amount
                status["liberapayPatrons_" + account] = json.npatrons
                status["liberapayUpdated_" + account] = new Date().toUTCString();
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

function refreshStatus() {
    refreshPatreonStatus();
    refreshLiberapayStatus("Tiled");
    refreshLiberapayStatus("bjorn");
}

// refresh status every 5 minutes (288 times a day)
setInterval(refreshStatus, 1000 * 60 * 5);
refreshStatus();
