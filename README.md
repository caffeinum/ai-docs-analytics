<p align="center">
  <img src="logo.png" alt="2027 Track" width="120" />
</p>

<h1 align="center">2027 Track</h1>

<p align="center">
  <strong>Know who's using your product: humans or agents</strong>
</p>

<p align="center">
  A lightweight, open source library to detect and track AI coding agents visiting your docs.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/2027-track"><img src="https://img.shields.io/npm/v/2027-track" alt="npm" /></a>
  <a href="https://github.com/team2027/track/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
</p>

---

## Quick Start

```bash
npm install 2027-track
```

```ts
// middleware.ts (Next.js)
import { withAIAnalytics } from "2027-track/next";

export default withAIAnalytics();

export const config = {
  matcher: ["/((?!api|_next|admin).*)",],
};
```

Works with any Vercel deployment too (Remix, SvelteKit, Astro, Nuxt):

```ts
// middleware.ts (Vercel)
import { withAIAnalytics } from "2027-track/vercel";

export default withAIAnalytics();

export const config = {
  matcher: "/((?!_next|api|favicon.ico|assets|.*\\..*).*)",
};
```

That's it. AI agent visits are now tracked.

## How It Works

AI coding agents (Claude Code, Codex, OpenCode) send `Accept: text/markdown` when fetching docs — browsers never do. We detect this signal and classify the visitor.

```
[Your Site] → [2027-track middleware] → [Analytics API] → [Your Dashboard]
```

## Detection

| Agent | Signal |
|-------|--------|
| Claude Code | `axios` user-agent + `text/markdown` accept |
| OpenCode | `text/markdown` with `q=` quality weights |
| Codex | `ChatGPT-User` user-agent |
| Unknown AI | `text/markdown` in accept (fallback) |

Bots and crawlers (Googlebot, GPTBot, etc.) are automatically filtered.

## Test Detection

See how your request gets classified:

```bash
curl https://ai-docs-analytics-api.theisease.workers.dev/detect
```

```json
{"category": "coding-agent", "agent": "opencode"}
```

## Privacy

- Events sent **server-side** from your edge/server — visitor IPs never reach us
- No cookies, no fingerprinting, no PII
- Only: host, path, user-agent, accept header, country
- Fully open source — audit the code yourself

## Self-Hosting

Don't want to send data to our API? Self-host everything:

```bash
# Clone and deploy your own API
git clone https://github.com/team2027/track
cd track/api
npx wrangler deploy
```

Set custom endpoint:
```bash
AI_ANALYTICS_ENDPOINT=https://your-worker.workers.dev/track
```

Set to empty to disable entirely:
```bash
AI_ANALYTICS_ENDPOINT=""
```

## API Reference

**Hosted API:** `https://ai-docs-analytics-api.theisease.workers.dev`

| Endpoint | Description |
|----------|-------------|
| `POST /track` | Record a visit |
| `GET /detect` | Test your headers |
| `GET /query?q=agents` | Agent breakdown |
| `GET /query?q=sites` | Visits by site |
| `GET /query?q=feed` | Recent visits |

## Project Structure

```
track/
├── api/                  # Cloudflare Worker
│   ├── detect.ts         # Classification logic
│   ├── index.ts          # API routes
│   └── wrangler.toml     # CF config
├── packages/middleware/  # npm package (2027-track)
│   └── src/
│       ├── index.ts      # Core tracking
│       ├── next.ts       # Next.js wrapper
│       └── vercel.ts     # Vercel edge middleware wrapper
└── dashboard/            # Analytics UI
```

## License

MIT — use it however you want.

---

<p align="center">
  Built by <a href="https://github.com/team2027">team2027</a> · <a href="https://twitter.com/2027dev">@2027dev</a>
</p>
