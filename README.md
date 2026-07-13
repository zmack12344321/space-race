# Space Race

A browser-based 3D racing game built with React Three Fiber, Vite, and PartyKit for multiplayer.

## Getting Started

Install dependencies and start the app plus PartyKit dev server:

```bash
npm install
npm run dev:worker
npm run dev
```

Local multiplayer uses `localhost:1999` by default. Shareable room links use the
`?room=` URL param.

## Build

```bash
npm run build
```

## Deploy

PartyKit managed deploy is currently blocked by the public `partykit.dev` custom
domain limit. Deploy the compatible PartyServer worker to Cloudflare, then deploy
Vercel with that worker host exposed to Vite:

```bash
npm run deploy:worker
vercel --prod --build-env VITE_PARTYKIT_HOST=space-race.<your-worker-subdomain>.workers.dev
```
