import { Hono } from "hono";
import { cors } from "hono/cors";

interface AnalyticsEngineDataset {
  writeDataPoint(data: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}

type Env = {
  RAW_EVENTS: AnalyticsEngineDataset;
  VISITS: AnalyticsEngineDataset;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

// RAW_EVENTS schema (immutable):
// blob1: host
// blob2: path
// blob3: user_agent
// blob4: accept_header
// blob5: country
// index1: host

// VISITS schema (processed):
// blob1: host
// blob2: path
// blob3: category
// blob4: agent
// blob5: country
// double1: is_filtered
// index1: host

const BOT_PATTERNS = [
  "googlebot", "bingbot", "yandexbot", "baiduspider", "duckduckbot", "slurp",
  "facebookexternalhit", "linkedinbot", "twitterbot",
  "applebot", "semrushbot", "ahrefsbot", "mj12bot", "dotbot", "petalbot", "bytespider",
  "gptbot", "claudebot", "anthropic-ai", "ccbot", "cohere-ai", "perplexitybot",
  "pingdom", "uptimerobot", "statuscake", "site24x7", "newrelic", "datadog", "checkly", "freshping",
  "vercel-healthcheck", "vercel-edge-functions",
  "wget", "curl", "httpie", "python-requests", "go-http-client",
  "scrapy", "httpclient", "java/", "okhttp", "axios", "node-fetch", "undici",
];

const PREVIEW_HOST_PATTERNS = [
  ".vercel.app",
  ".netlify.app",
  ".pages.dev",
  "localhost",
  "127.0.0.1",
];

type VisitorCategory = "bot" | "browsing-agent" | "coding-agent" | "human";

interface Classification {
  category: VisitorCategory;
  agent: string;
  filtered: boolean;
}

function detectBotName(ua: string): string {
  for (const pattern of BOT_PATTERNS) {
    if (ua.includes(pattern)) {
      return pattern;
    }
  }
  return "unknown-bot";
}

function classify(userAgent: string, acceptHeader: string, host: string): Classification {
  const ua = userAgent.toLowerCase();
  const accept = acceptHeader.toLowerCase();
  const wantsMarkdown = accept.includes("text/markdown");

  if (ua.includes("claude-code") || ua.includes("claudecode")) {
    return { category: "coding-agent", agent: "claude-code", filtered: false };
  }
  if (ua.includes("codex")) {
    return { category: "coding-agent", agent: "codex", filtered: false };
  }
  if (ua.includes("opencode")) {
    return { category: "coding-agent", agent: "opencode", filtered: false };
  }
  if (ua.includes("chatgpt-user")) {
    return { category: "coding-agent", agent: "codex", filtered: false };
  }
  // Claude Code webfetch: axios + text/markdown (no q= weights)
  if (ua.includes("axios") && wantsMarkdown && !accept.includes("q=")) {
    return { category: "coding-agent", agent: "claude-code", filtered: false };
  }
  // OpenCode: text/plain + text/markdown with q= weights
  if (accept.includes("text/plain") && wantsMarkdown && accept.includes("q=")) {
    return { category: "coding-agent", agent: "opencode", filtered: false };
  }
  if (ua.includes("claude/1.0") || (ua.includes("claude") && ua.includes("compatible"))) {
    return { category: "browsing-agent", agent: "claude-computer-use", filtered: true };
  }
  if (ua.includes("perplexity-user")) {
    return { category: "browsing-agent", agent: "perplexity-comet", filtered: true };
  }
  if (wantsMarkdown) {
    return { category: "coding-agent", agent: "unknown-coding-agent", filtered: false };
  }
  if (BOT_PATTERNS.some(pattern => ua.includes(pattern))) {
    return { category: "bot", agent: detectBotName(ua), filtered: true };
  }
  if (PREVIEW_HOST_PATTERNS.some(pattern => host.toLowerCase().includes(pattern))) {
    return { category: "human", agent: "browser", filtered: true };
  }
  return { category: "human", agent: "browser", filtered: false };
}

function isPageView(accept: string): boolean {
  const a = accept.toLowerCase();
  return a.includes("text/html") || a.includes("text/markdown") || a.includes("text/plain");
}

app.post("/track", async (c) => {
  const body = await c.req.json();

  const accept = body.accept_header || body.accept || "";
  const userAgent = body.user_agent || body.ua || "";
  const host = body.host || "unknown";
  const path = body.path || "/";
  const country = body.country || "unknown";

  if (!isPageView(accept)) {
    return c.json({ ok: true, skipped: "not-page-view" });
  }

  const { category, agent, filtered } = classify(userAgent, accept, host);

  // RAW_EVENTS: immutable capture
  c.env.RAW_EVENTS.writeDataPoint({
    blobs: [host, path, userAgent.slice(0, 500), accept.slice(0, 500), country],
    indexes: [host],
  });

  // VISITS: processed classification
  c.env.VISITS.writeDataPoint({
    blobs: [host, path, category, agent, country],
    doubles: [filtered ? 1 : 0],
    indexes: [host],
  });

  return c.json({ ok: true, category, agent, filtered: filtered || undefined });
});

app.get("/detect", (c) => {
  const userAgent = c.req.header("user-agent") || "";
  const accept = c.req.header("accept") || "";
  const host = c.req.header("host") || "unknown";

  const { category, agent, filtered } = classify(userAgent, accept, host);

  return c.json({
    category,
    agent,
    filtered: filtered || undefined,
    headers: { user_agent: userAgent, accept },
  });
});

const ALLOWED_QUERIES: Record<string, string> = {
  default: `
    SELECT blob1 as host, blob3 as category, blob4 as agent, SUM(_sample_interval) as visits
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '7' DAY AND double1 = 0
    GROUP BY host, category, agent
    ORDER BY visits DESC
    LIMIT 100
  `,
  sites: `
    SELECT blob1 as host, blob3 as category, SUM(_sample_interval) as visits
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '7' DAY AND double1 = 0
    GROUP BY host, category
    ORDER BY visits DESC
  `,
  agents: `
    SELECT blob4 as agent, SUM(_sample_interval) as visits
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '7' DAY AND double1 = 0 AND blob3 = 'coding-agent'
    GROUP BY agent
    ORDER BY visits DESC
  `,
  "all-agents": `
    SELECT blob3 as category, blob4 as agent, SUM(_sample_interval) as visits
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '7' DAY AND double1 = 0
    GROUP BY category, agent
    ORDER BY visits DESC
  `,
  pages: `
    SELECT blob1 as host, blob2 as path, blob4 as agent, SUM(_sample_interval) as visits
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '7' DAY AND blob3 = 'coding-agent' AND double1 = 0
    GROUP BY host, path, agent
    ORDER BY visits DESC
    LIMIT 50
  `,
  feed: `
    SELECT timestamp, blob1 as host, blob2 as path, blob3 as category, blob4 as agent
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '1' DAY AND double1 = 0
    ORDER BY timestamp DESC
    LIMIT 50
  `,
  raw: `
    SELECT timestamp, blob1 as host, blob2 as path, blob3 as user_agent, blob4 as accept_header
    FROM ai_docs_raw_events
    WHERE timestamp > NOW() - INTERVAL '1' DAY
    ORDER BY timestamp DESC
    LIMIT 100
  `,
};

app.get("/query", async (c) => {
  const accountId = c.env.CF_ACCOUNT_ID;
  const apiToken = c.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return c.json({ error: "missing CF_ACCOUNT_ID or CF_API_TOKEN" }, 500);
  }

  const queryName = c.req.query("q") || "default";
  const host = c.req.query("host");

  const baseSql = ALLOWED_QUERIES[queryName];
  if (!baseSql) {
    return c.json({ error: "invalid query", allowed: Object.keys(ALLOWED_QUERIES) }, 400);
  }

  let sql = baseSql;
  if (host) {
    sql = sql.replace("WHERE ", `WHERE blob1 = '${host.replace(/'/g, "''")}' AND `);
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "text/plain",
      },
      body: sql,
    }
  );

  const data = await response.json();
  return c.json(data);
});

app.get("/health", (c) => c.json({ ok: true }));

export default app;
