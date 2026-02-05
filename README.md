# AI Docs Analytics

Track AI coding agents (Claude Code, Codex, OpenCode, etc.) visiting your documentation.

## How It Works

AI coding agents send `Accept: text/markdown` header when fetching docs - browsers don't. We detect this signal and store events in Cloudflare Analytics Engine.

## Architecture

```
[Your Docs Site] → [CF Worker API] → [CF Analytics Engine] → [Dashboard]
     middleware        /track            storage              Next.js
```

## Detection

| Agent | Detection Method |
|-------|-----------------|
| claude-code | `claude-code` in user-agent |
| codex | `codex` in UA, or `chatgpt-user` in UA |
| opencode | `opencode` in UA, or Accept has `text/plain` + `text/markdown` + `q=` |
| unknown-coding-agent | `text/markdown` in Accept header |

Filtered (not counted in stats):
- Bots/crawlers (googlebot, gptbot, etc.)
- Browsing agents (claude-computer-use, perplexity-comet)

## Test Your Agent

```bash
curl https://ai-docs-analytics-api.theisease.workers.dev/detect
```

Returns how your request would be classified:
```json
{
  "category": "coding-agent",
  "agent": "opencode",
  "headers": { "user_agent": "...", "accept": "..." }
}
```

## API Endpoints

**Base URL:** `https://ai-docs-analytics-api.theisease.workers.dev`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/track` | POST | Record a visit |
| `/detect` | GET | Test classification with your headers |
| `/query?q=agents` | GET | Coding agent breakdown |
| `/query?q=sites` | GET | Visits by site |
| `/query?q=pages` | GET | Top pages by AI visits |
| `/query?q=feed` | GET | Recent visits feed |
| `/health` | GET | Health check |

## Project Structure

```
ai-docs-analytics/
├── api/                 # CF Worker (Hono)
│   ├── index.ts         # Detection logic + endpoints
│   └── wrangler.toml    # CF config
└── dashboard/           # Next.js dashboard
    └── app/page.tsx     # Visualization
```

## Development

```bash
# API
cd api && npm install && npx wrangler dev

# Dashboard
cd dashboard && npm install && npm run dev
```

## Deploy

```bash
cd api && npx wrangler deploy
```
