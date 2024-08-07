const http = require("http");
const url = require('url');
const fetch = require('node-fetch')
require('dotenv').config()

const port = process.env.WEB_PORT ?? 80;
const eurToUsd = 1.07;

let refreshTimeout = null;

const status = {
    totalAmount: 0,
    totalContributors: 0,
    updated: "Never",
    patreon: {
        amount: 0,
        contributors: 0,
        updated: "Never",
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
    opencollective: {
        amount: 0,
        contributors: 0,
        updated: "Never",
    }
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

    let amount = campaign.attributes.pledge_sum / 100;

    if (campaign.attributes.pledge_sum_currency === "EUR") {
        amount *= eurToUsd;
    }

    status["patreon"] = {
        amount: amount,
        contributors: campaign.attributes.paid_member_count,
        updated: new Date().toUTCString(),
    };
}

async function refreshLiberapay(liberapayId) {
    try {
        const req = await fetch(`https://liberapay.com/${liberapayId}/public.json`);
        const res = await req.json();

        let amount = parseFloat(res.receiving.amount) ?? 0;
        if (res.receiving.currency === "EUR") {
            amount *= eurToUsd;
        }

        let weeklyToMonthly = 52.0/12;
        amount *= weeklyToMonthly;

        status["liberapay"] = {
            amount: amount,
            contributors: res.npatrons,
            updated: new Date().toUTCString()
        };
    } catch (err) {
        console.error("Error refreshing Liberapay:");
        console.error(err);
    }
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
        amount: (res.data.user.monthlyEstimatedSponsorsIncomeInCents ?? 0) / 100,
        contributors: res.data.user.sponsors.totalCount,
        updated: new Date().toUTCString()
    }
}

async function refreshOpenCollective(collective) {
    try {
        const req = await fetch(`https://opencollective.com/${collective}.json`);
        const res = await req.json();

        let amount = res.yearlyIncome / 12 / 100;
        if (res.currency === "EUR") {
            amount *= eurToUsd;
        }

        status["opencollective"] = {
            amount: amount,
            contributors: res.backersCount,
            updated: new Date().toUTCString()
        };
    } catch (err) {
        console.error("Error refreshing OpenCollective:");
        console.error(err);
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

    if (process.env.OPENCOLLECTIVE_NAME) {
        promises.push(refreshOpenCollective(process.env.OPENCOLLECTIVE_NAME));
    }

    Promise.all(promises).then(() => {
        status.totalAmount = status.patreon.amount + status.liberapay.amount + status.github.amount + status.opencollective.amount;
        status.totalContributors = status.patreon.contributors + status.liberapay.contributors + status.github.contributors + status.opencollective.contributors;
        status.updated = new Date().toUTCString();
    });
}

// refresh status regularly
setInterval(refreshStatus, 1000 * 60 * Math.max(1, process.env.REFRESH_TIME ?? 5));
refreshStatus();
