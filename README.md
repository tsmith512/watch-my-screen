# Watch My Screen

A Chrome screen-sharing demo that publishes a display to Cloudflare Stream over WHIP and previews it through the Stream player.

Built from the architecture of [@tsmith512/magic-mirror](https://github.com/tsmith512/magic-mirror).

The first Start click for a loaded page creates one live input. Stop ends only the local display capture and WebRTC connection, so later Start clicks reuse that same input. The input is deleted 12 hours after creation by the cleanup queue.

## Setup

Create the queue before the first deploy:

```sh
npx wrangler queues create watch-my-screen-cleanup
```

Set production secrets:

```sh
npx wrangler secret put CLOUDFLARE_API_TOKEN
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
```

For local development, create a gitignored `.dev.vars` file:

```ini
CLOUDFLARE_API_TOKEN=<Stream:Edit token>
CLOUDFLARE_ACCOUNT_ID=<account ID>
```

Run locally with `npm run dev`, test with `npm test`, and deploy with `npm run deploy`.
