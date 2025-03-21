# Patreon Watcher

A tiny Deno app that polls various crowdfunding sites to quickly provide current
funding status for website integration.

Supported platforms:

- [GitHub Sponsors](https://github.com/sponsors)
- [Liberapay](https://liberapay.com/)
- [OpenCollective](https://opencollective.com)
- [Patreon](https://patreon.com)

## Setup

### Option 1: Run with Deno

1. Make sure [Deno is installed](https://deno.land/#installation)
2. Copy environment template: `cp .env.example .env`
3. Fill in your credentials in `.env`
4. Run the server:
   ```bash
   # Start the server
   deno task start

   # Development mode with auto-reload
   deno task dev
   ```

### Option 2: Run with Docker

1. Copy environment template: `cp .env.example .env`
2. Fill in your credentials in `.env`
3. Build and run using Docker:
   ```bash
   docker build -t pw .
   docker run --env-file .env -p 8080:80 pw
   ```

## API Endpoints

- `GET /`: Returns JSON with current funding stats
- `GET /on_create`, `/on_update`, `/on_delete`: Webhook endpoints for Patreon
  events

## Example Response

```json
{
  "totalAmount": 1234.56,
  "totalContributors": 42,
  "updated": "Mon, 01 Jan 2023 12:00:00 GMT",
  "patreon": {
    "amount": 500.00,
    "contributors": 20,
    "updated": "Mon, 01 Jan 2023 12:00:00 GMT"
  },
  "liberapay": {
    "amount": 200.00,
    "contributors": 10,
    "updated": "Mon, 01 Jan 2023 12:00:00 GMT"
  },
  "github": {
    "amount": 300.00,
    "contributors": 7,
    "updated": "Mon, 01 Jan 2023 12:00:00 GMT"
  },
  "opencollective": {
    "amount": 234.56,
    "contributors": 5,
    "updated": "Mon, 01 Jan 2023 12:00:00 GMT"
  }
}
```
