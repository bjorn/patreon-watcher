import "std/dotenv/load.ts";

const env = Deno.env;
const port = Number(env.get("WEB_PORT")) || 80;
const eurToUsd = 1.07;

let refreshTimeout: number | null = null;

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
  },
};

function findObject<T extends { type: string; id: string }>(
  included: T[],
  data: { type: string; id: string },
): T | null {
  for (let i = 0; i < included.length; ++i) {
    const object = included[i];
    if (object.type === data.type && object.id === data.id) {
      return object;
    }
  }
  return null;
}

async function refreshPatreon(patreonId: string) {
  try {
    const req = await fetch(`https://api.patreon.com/user/${patreonId}`);
    const res = await req.json() as {
      data: {
        relationships: {
          campaign: { data: { type: string; id: string } };
        };
      };
      included: {
        type: string;
        id: string;
        attributes: {
          pledge_sum: number;
          paid_member_count: number;
          pledge_sum_currency: string;
        };
      }[];
    };

    // Check if data structure is as expected
    if (!res.data?.relationships?.campaign?.data) {
      console.error("Patreon API response missing campaign data");
      return;
    }

    const campaign = findObject(
      res.included,
      res.data.relationships.campaign.data,
    );

    // Check if campaign was found
    if (!campaign) {
      console.error("Campaign not found in Patreon response");
      return;
    }

    let amount = campaign.attributes.pledge_sum / 100;

    if (campaign.attributes.pledge_sum_currency === "EUR") {
      amount *= eurToUsd;
    }

    status["patreon"] = {
      amount: amount,
      contributors: campaign.attributes.paid_member_count,
      updated: new Date().toUTCString(),
    };
  } catch (err) {
    console.error("Error refreshing Patreon:", err);
  }
}

async function refreshLiberapay(liberapayId: string) {
  try {
    const req = await fetch(
      `https://liberapay.com/${liberapayId}/public.json`,
    );
    const res = await req.json();

    let amount = parseFloat(res.receiving.amount) || 0;
    if (res.receiving.currency === "EUR") {
      amount *= eurToUsd;
    }

    const weeklyToMonthly = 52.0 / 12;
    amount *= weeklyToMonthly;

    status["liberapay"] = {
      amount: amount,
      contributors: res.npatrons,
      updated: new Date().toUTCString(),
    };
  } catch (err) {
    console.error("Error refreshing Liberapay:", err);
  }
}

async function refreshGithubSponsors(
  githubUsername: string,
  githubToken: string,
) {
  try {
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
        }`;

    const req = await fetch(`https://api.github.com/graphql`, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: {
        "Authorization": `Bearer ${githubToken}`,
      },
    });

    const res = await req.json();

    if (res.errors) {
      console.error("GitHub API error:", res.errors);
      return;
    }

    status["github"] = {
      amount: ((res.data?.user?.monthlyEstimatedSponsorsIncomeInCents) || 0) /
        100,
      contributors: (res.data?.user?.sponsors?.totalCount) || 0,
      updated: new Date().toUTCString(),
    };
  } catch (err) {
    console.error("Error refreshing GitHub sponsors:", err);
  }
}

async function refreshOpenCollective(collective: string) {
  try {
    const req = await fetch(
      `https://opencollective.com/${collective}.json`,
    );
    const res = await req.json();

    let amount = res.yearlyIncome / 12 / 100;
    if (res.currency === "EUR") {
      amount *= eurToUsd;
    }

    status["opencollective"] = {
      amount: amount,
      contributors: res.backersCount,
      updated: new Date().toUTCString(),
    };
  } catch (err) {
    console.error("Error refreshing OpenCollective:", err);
  }
}

function refreshStatus() {
  const promises: Promise<void>[] = [];

  const patreonId = env.get("PATREON_ID");
  if (patreonId) {
    promises.push(refreshPatreon(patreonId));
  }

  const liberapayId = env.get("LIBERAPAY_ID");
  if (liberapayId) {
    promises.push(refreshLiberapay(liberapayId));
  }

  const githubUsername = env.get("GITHUB_USERNAME");
  const githubToken = env.get("GITHUB_TOKEN");
  if (githubUsername && githubToken) {
    promises.push(refreshGithubSponsors(githubUsername, githubToken));
  }

  const opencollectiveName = env.get("OPENCOLLECTIVE_NAME");
  if (opencollectiveName) {
    promises.push(refreshOpenCollective(opencollectiveName));
  }

  Promise.all(promises).then(() => {
    status.totalAmount = status.patreon.amount + status.liberapay.amount +
      status.github.amount + status.opencollective.amount;
    status.totalContributors = status.patreon.contributors +
      status.liberapay.contributors + status.github.contributors +
      status.opencollective.contributors;
    status.updated = new Date().toUTCString();
  }).catch((err) => {
    console.error("Error refreshing status:", err);
  });
}

// Refresh status regularly
const refreshTime = Number(env.get("REFRESH_TIME")) || 5;
setInterval(refreshStatus, 1000 * 60 * Math.max(1, refreshTime));
refreshStatus();

// Handle requests
Deno.serve({ port }, (request: Request) => {
  const url = new URL(request.url);
  const pledges = ["/on_create", "/on_update", "/on_delete"];

  if (pledges.includes(url.pathname)) {
    // A pledge was created, updated or deleted
    if (!refreshTimeout) {
      refreshStatus();

      // Don't refresh for ten seconds
      refreshTimeout = setTimeout(() => {
        refreshTimeout = null;
      }, 10 * 1000);

      return new Response("Refreshing", { status: 200 });
    } else {
      return new Response("Ignored", { status: 200 });
    }
  } else if (url.pathname === "/") {
    return new Response(JSON.stringify(status, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } else {
    return new Response("Not Found", { status: 404 });
  }
});
