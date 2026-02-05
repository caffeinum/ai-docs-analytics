import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  TINYBIRD_TOKEN: string;
  TINYBIRD_DATASOURCE?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

function detectIsAI(accept: string): boolean {
  const wantsMarkdown = accept.includes("text/markdown");
  const wantsPlainText = accept.includes("text/plain") && !accept.startsWith("text/html");
  return wantsMarkdown || wantsPlainText;
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

  const event = {
    ts: body.ts || new Date().toISOString().slice(0, 19).replace("T", " "),
    host: body.host || "unknown",
    path: body.path || "/",
    agent_type: agentType,
    is_ai: isAI ? 1 : 0,
    ua: isAI ? userAgent.slice(0, 500) : "",
  };

  const datasource = c.env.TINYBIRD_DATASOURCE || "ai_agent_events";
  const endpoint = `https://api.us-east.aws.tinybird.co/v0/events?name=${datasource}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.TINYBIRD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    console.error("tinybird error:", await response.text());
    return c.json({ error: "failed to track" }, 500);
  }

  return c.json({ ok: true });
});

app.get("/health", (c) => c.json({ ok: true }));

export default app;
