# 2027-track

**Know who's using your product: humans or agents**

Lightweight middleware to detect and track AI coding agents visiting your docs.

## Install

```bash
npm install 2027-track
```

## Next.js

```ts
// middleware.ts
import { withAIAnalytics } from "2027-track/next";

export default withAIAnalytics();

export const config = {
  matcher: ["/((?!api|_next|admin|auth).*)",],
};
```

Or wrap existing middleware:

```ts
export default withAIAnalytics(yourMiddleware);
```

## Vercel (any framework)

Works with Remix, SvelteKit, Astro, Nuxt, or any Vercel deployment:

```ts
// middleware.ts
import { withAIAnalytics } from "2027-track/vercel";

export default withAIAnalytics();

export const config = {
  matcher: "/((?!_next|api|favicon.ico|assets|.*\\..*).*)",
};
```

Or wrap existing middleware:

```ts
export default withAIAnalytics(yourMiddleware);
```

Or use `trackVisit` directly:

```ts
import { trackVisit } from "2027-track";

export const config = {
  matcher: "/((?!_next|api|favicon.ico|assets|.*\\..*).*)",
};

export default function middleware(request: Request, context: { waitUntil: (promise: Promise<unknown>) => void }) {
  const url = new URL(request.url);
  context.waitUntil(
    trackVisit({
      host: url.hostname,
      path: url.pathname,
      userAgent: request.headers.get("user-agent") || "",
      accept: request.headers.get("accept") || "",
      country: request.headers.get("x-vercel-ip-country") || undefined,
    }).catch(() => {})
  );
}
```

## Generic Usage

```ts
import { trackVisit } from "2027-track";

await trackVisit({
  host: "docs.example.com",
  path: "/getting-started",
  userAgent: request.headers.get("user-agent"),
  accept: request.headers.get("accept"),
});
```

## Configuration

```bash
# Disable tracking
AI_ANALYTICS_ENDPOINT=""

# Self-host (optional)
AI_ANALYTICS_ENDPOINT="https://your-api.workers.dev/track"
```

## Privacy

- Events sent **server-side** — visitor IPs never reach the analytics endpoint
- No cookies, no fingerprinting, no PII
- Fully open source — [audit the code](https://github.com/team2027/track)

## Detection

| Agent | Signal |
|-------|--------|
| Claude Code | `axios` + `text/markdown` |
| OpenCode | `text/markdown` with `q=` weights |
| Codex | `ChatGPT-User` user-agent |

## Links

- [GitHub](https://github.com/team2027/track)
- [Test your agent](https://ai-docs-analytics-api.theisease.workers.dev/detect)

## License

MIT
