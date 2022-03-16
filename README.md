Patreon Watcher
---------------

A tiny node.js app that polls my Patreon page in order to quickly provide the
current status for website integration.

### Run

Copy environment `cp .env.example .env`
Fill in `.env`

Then run Docker

```
docker build -t pw
docker run --env-file .env -p 8005:80 pw
```