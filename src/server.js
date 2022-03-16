const http = require("http");
const url = require('url');
const fetch = require('node-fetch')
require('dotenv').config()

const port = process.env.WEB_PORT ?? 80;
const eurToUsd = 1.1;

let refreshTimeout = null;

const status = {
    totalAmount: 0,
    totalContributors: 0,
    updated: "Never",
    patreon: {
        amount: 0,
        contributors: 0,
        updated: "Never",
        nextGoal: 0,
    },
    liberapay: {
        amount: 0,
        contributors: 0,
        updated: "Never",
    },
    github: {
        amount: 0,
        contributors: 0,
        updated: "Never",
    },
};

http.createServer(function (request, response) {
    const pledges = ['/on_create', '/on_update', '/on_delete'];

    if (pledges.includes(request.url)) {
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
    } else if (request.url === '/') {
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

async function refreshPatreon(patreonId) {
    const req = await fetch(`https://api.patreon.com/user/${patreonId}`);
    const res = await req.json();

    const campaign = findObject(res.included, res.data.relationships.campaign.data)

    const goals = campaign.relationships.goals.data;
    let nextGoal = null;

    for (let i = 0; i < goals.length; ++i) {
        const goal = findObject(res.included, goals[i])
        if (goal.attributes.completed_percentage < 100 && (nextGoal === null || nextGoal.attributes.amount_cents > goal.attributes.amount_cents))
            nextGoal = goal;
    }

    let amount = campaign.attributes.pledge_sum / 100;

    if (campaign.attributes.pledge_sum_currency === "EUR") {
        amount *= eurToUsd;
    }

    status["patreon"] = {
        amount: amount,
        contributors: campaign.attributes.patron_count,
        updated: new Date().toUTCString(),
        nextGoal: (nextGoal ? nextGoal.attributes.amount_cents / 100 : 0) * eurToUsd,
    };
}

async function refreshLiberapay(liberapayId) {
    const req = await fetch(`https://liberapay.com/${liberapayId}/public.json`);
    const res = await req.json();

    let amount = parseFloat(res.receiving.amount) ?? 0;
    if (res.receiving.currency === "EUR") {
        amount *= eurToUsd;
    }

    status["liberapay"] = {
        amount: amount,
        contributors: res.npatrons,
        updated: new Date().toUTCString()
    };
}

async function refreshGithubSponsors(githubUsername) {
    const query = `
    query {
        user(login: "${githubUsername}") {
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

    status['github'] = {
        foo: res.data.user.monthlyEstimatedSponsorsIncomeInCents,
        amount: ((res.data.user.monthlyEstimatedSponsorsIncomeInCents ?? 0) / 100),
        contributors: res.data.user.sponsors.totalCount,
        updated: new Date().toUTCString()
    }
}

function refreshStatus() {
    const promises = [];

    if (process.env.PATREON_ID) {
        promises.push(refreshPatreon(process.env.PATREON_ID));
    }

    if (process.env.LIBERAPAY_ID) {
        promises.push(refreshLiberapay(process.env.LIBERAPAY_ID));
    }

    if (process.env.GITHUB_USERNAME) {
        promises.push(refreshGithubSponsors(process.env.GITHUB_USERNAME));
    }

    Promise.all(promises).then(() => {
        status.totalAmount = status.patreon.amount + status.liberapay.amount + status.github.amount;
        status.totalContributors = status.patreon.contributors + status.liberapay.contributors + status.github.contributors;
        status.updated = new Date().toUTCString();
    });
}

// refresh status regularly
setInterval(refreshStatus, 1000 * 60 * (process.env.REFRESH_TIME ?? 5));
refreshStatus();
