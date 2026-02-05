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
  ANALYTICS: AnalyticsEngineDataset;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

const BOT_PATTERNS = [
  "googlebot", "bingbot", "yandexbot", "baiduspider", "duckduckbot",
  "slurp", "facebookexternalhit", "linkedinbot", "twitterbot",
  "applebot", "semrushbot", "ahrefsbot", "mj12bot", "dotbot",
  "petalbot", "bytespider", "gptbot", "claudebot", "anthropic-ai",
  "pingdom", "uptimerobot", "statuscake", "site24x7", "newrelic",
  "datadog", "checkly", "freshping",
  "vercel-healthcheck", "vercel-edge-functions",
  "wget", "curl", "httpie", "python-requests", "go-http-client",
  "scrapy", "httpclient", "java/", "okhttp", "axios",
  "node-fetch", "undici",
];

const PREVIEW_HOST_PATTERNS = [
  ".vercel.app",
  ".netlify.app", 
  ".pages.dev",
  "localhost",
  "127.0.0.1",
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

function isPreviewHost(host: string): boolean {
  const h = host.toLowerCase();
  return PREVIEW_HOST_PATTERNS.some(pattern => h.includes(pattern));
}

function detectIsAI(accept: string): boolean {
  const wantsMarkdown = accept.includes("text/markdown");
  const wantsPlainText = accept.includes("text/plain") && !accept.startsWith("text/html");
  return wantsMarkdown || wantsPlainText;
}

function isPageView(accept: string): boolean {
  const wantsHtml = accept.includes("text/html");
  const wantsMarkdown = accept.includes("text/markdown");
  const wantsPlainText = accept.includes("text/plain");
  return wantsHtml || wantsMarkdown || wantsPlainText;
}

function detectAgentType(userAgent: string, isAI: boolean): string {
  if (!isAI) return "human";
  const ua = userAgent.toLowerCase();
  if (ua.includes("claude-code") || ua.includes("claudecode")) return "claude-code";
  if (ua.includes("cursor")) return "cursor";
  if (ua.includes("windsurf")) return "windsurf";
  if (ua.includes("opencode")) return "opencode";
  if (ua.includes("aider")) return "aider";
  if (ua.includes("continue")) return "continue";
  if (ua.includes("copilot")) return "copilot";
  if (ua.includes("cline")) return "cline";
  return "unknown-ai";
}

app.post("/track", async (c) => {
  const body = await c.req.json();

  const accept = body.accept_header || body.accept || "";
  const userAgent = body.user_agent || body.ua || "";
  const isAI = body.is_ai !== undefined ? Boolean(body.is_ai) : detectIsAI(accept);
  const agentType = body.agent_type || detectAgentType(userAgent, isAI);
  const host = body.host || "unknown";
  const path = body.path || "/";
  const country = body.country || "unknown";

  let filterReason = "";
  if (!isPageView(accept)) {
    filterReason = "not-page-view";
  } else if (!isAI && isBot(userAgent)) {
    filterReason = "bot";
  } else if (!isAI && isPreviewHost(host)) {
    filterReason = "preview";
  }

  c.env.ANALYTICS.writeDataPoint({
    blobs: [host, path, agentType, country, userAgent.slice(0, 500), accept.slice(0, 500), filterReason],
    doubles: [isAI ? 1 : 0, filterReason ? 1 : 0],
    indexes: [host],
  });

  return c.json({ ok: true, filtered: filterReason || undefined });
});

app.get("/query", async (c) => {
  const accountId = c.env.CF_ACCOUNT_ID;
  const apiToken = c.env.CF_API_TOKEN;
  
  if (!accountId || !apiToken) {
    return c.json({ error: "missing CF_ACCOUNT_ID or CF_API_TOKEN" }, 500);
  }

  const sql = c.req.query("sql") || `
    SELECT 
      blob1 as host,
      blob3 as agent_type,
      SUM(_sample_interval) as visits
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '7' DAY
      AND double2 = 0
    GROUP BY host, agent_type
    ORDER BY visits DESC
    LIMIT 100
  `;

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
