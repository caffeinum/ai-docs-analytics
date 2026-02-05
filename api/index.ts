import { Hono } from "hono";
import { cors } from "hono/cors";
import { classify, isPageView } from "./detect";
import { generateEventId, writeRawEvent, writeVisit, type Env } from "./db";
import { runQuery, QUERIES } from "./queries";

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

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
  const eventId = generateEventId();

  writeRawEvent(c.env.RAW_EVENTS, eventId, host, path, userAgent, accept, country);
  writeVisit(c.env.VISITS, eventId, host, path, category, agent, country, filtered);

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

app.get("/query", async (c) => {
  const accountId = c.env.CF_ACCOUNT_ID;
  const apiToken = c.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return c.json({ error: "missing CF_ACCOUNT_ID or CF_API_TOKEN" }, 500);
  }

  const queryName = c.req.query("q") || "default";
  const host = c.req.query("host");

  const result = await runQuery(accountId, apiToken, queryName, host);
  if (result.error) {
    return c.json({ error: result.error, allowed: Object.keys(QUERIES) }, 400);
  }
  return c.json(result);
});

app.get("/health", (c) => c.json({ ok: true }));

export default app;
