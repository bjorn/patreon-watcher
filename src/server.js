const http = require("http");
const url = require('url');
const fetch = require('node-fetch')
require('dotenv').config()

const port = process.env.WEB_PORT;

let refreshTimeout = null;

const status = {
    earnings: 0,
    patrons: 0,
    updated: "Never",
    liberapayEarnings_Tiled: 0,
    liberapayPatrons_Tiled: 0,
    liberapayUpdated_Tiled: "Never",
    liberapayEarnings_bjorn: 0,
    liberapayPatrons_bjorn: 0,
    liberapayUpdated_bjorn: "Never",
    githubSponsors: 0,
    githubIncomeFromSponsors: 0,
};

http.createServer(function (request, response) {
    const pathname = url.parse(request.url).pathname;

    if (pathname === '/on_create' ||
        pathname === '/on_update' ||
        pathname === '/on_delete') {
        // A pledge was created, updated or deleted
        if (!refreshTimeout) {
            refreshStatus();
            response.writeHead(200);
            response.end('Refreshing');

            // Don't refresh for ten seconds
            refreshTimeout = setTimeout(function () {
                refreshTimeout = null
            }, 10 * 1000)
        } else {
            response.writeHead(200);
            response.end('Ignored');
        }
    } else if (pathname === '/') {
        response.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        response.end(JSON.stringify(status, null, 2));
    } else {
        response.writeHead(404);
        response.end();
    }
}).listen(port);

console.log('Server running at http://127.0.0.1:' + port + '/');

function findObject(included, data) {
    for (let i = 0; i < included.length; ++i) {
        const object = included[i]
        if (object.type === data.type && object.id === data.id) {
            return object;
        }
    }
    return null;
}

async function refreshPatreonStatus() {
    const req = await fetch(`https://api.patreon.com/user/${process.env.PATREON_ID}`);
    const res = await req.json();

    const campaign = findObject(res.included, res.data.relationships.campaign.data)

    const goals = campaign.relationships.goals.data;
    let nextGoal = null;

    for (let i = 0; i < goals.length; ++i) {
        const goal = findObject(res.included, goals[i])
        if (goal.attributes.completed_percentage < 100 && (nextGoal === null || nextGoal.attributes.amount_cents > goal.attributes.amount_cents))
            nextGoal = goal;
    }

    status.earnings = campaign.attributes.pledge_sum / 100;
    status.patrons = campaign.attributes.patron_count;

    if (nextGoal)
        status.next_goal = nextGoal.attributes.amount_cents / 100;

    status.updated = new Date().toUTCString();
}

async function refreshLiberapayStatus() {
    const req = await fetch(`https://liberapay.com/${process.env.LIBERAPAY_ID}/public.json`);

    const res = await req.json();

    status["liberapayEarnings"] = res.receiving.amount
    status["liberapayPatrons"] = res.npatrons
    status["liberapayUpdated"] = new Date().toUTCString();
}

async function refreshGithubSponsors() {

    const query = `
    query {
        user(login: "${process.env.GITHUB_USERNAME}") {
        ... on Sponsorable {
                sponsors(first: 10) {
                    totalCount
                }
            },
            monthlyEstimatedSponsorsIncomeInCents
        }
    }`

    const req = await fetch(`https://api.github.com/graphql`, {
        method: 'POST',
        body: JSON.stringify({query}),
        headers: {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        }
    });

    const res = await req.json();

    status['githubIncomeFromSponsors'] = ((res.data.monthlyEstimatedSponsorsIncomeInCents ?? 0) / 100).toFixed(2)
    status["githubSponsors"] = res.data.user.sponsors.totalCount;
}

function refreshStatus() {
    refreshPatreonStatus();
    refreshLiberapayStatus("Tiled");
    refreshLiberapayStatus("bjorn");
    refreshGithubSponsors()
}

// refresh status every 5 minutes (288 times a day)
setInterval(refreshStatus, 1000 * 60 * 5);
refreshStatus();
