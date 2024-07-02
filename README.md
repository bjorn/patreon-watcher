Patreon Watcher
---------------

A tiny node.js app that polls various crowdfunding sites in order to quickly
provide the current status for website integration.

Supported platforms are:

* [GitHub Sponsors](https://github.com/sponsors)
* [Liberapay](https://liberapay.com/)
* [OpenCollective](https://opencollective.com)
* [Patreon](https://patreon.com)

### Run

* Copy environment `cp .env.example .env`
* Fill in `.env`

Then run Docker:

```
docker build -t pw .
docker run --env-file .env -p 8005:80 pw
```
