export type VisitorCategory = "bot" | "browsing-agent" | "coding-agent" | "human";

export interface Classification {
  category: VisitorCategory;
  agent: string;
  filtered: boolean;
}

const BOT_PATTERNS = [
  "googlebot", "bingbot", "yandexbot", "baiduspider", "duckduckbot", "slurp",
  "facebookexternalhit", "linkedinbot", "twitterbot",
  "applebot", "semrushbot", "ahrefsbot", "mj12bot", "dotbot", "petalbot", "bytespider",
  "gptbot", "claudebot", "anthropic-ai", "ccbot", "cohere-ai", "perplexitybot",
  "pingdom", "uptimerobot", "statuscake", "site24x7", "newrelic", "datadog", "checkly", "freshping",
  "vercel-healthcheck", "vercel-edge-functions",
  "wget", "curl", "httpie", "python-requests", "go-http-client",
  "scrapy", "httpclient", "java/", "okhttp", "node-fetch", "undici",
];

const PREVIEW_HOST_PATTERNS = [
  ".vercel.app",
  ".netlify.app",
  ".pages.dev",
  "localhost",
  "127.0.0.1",
];

function detectBotName(ua: string): string {
  for (const pattern of BOT_PATTERNS) {
    if (ua.includes(pattern)) return pattern;
  }
  return "unknown-bot";
}

export function classify(userAgent: string, acceptHeader: string, host: string): Classification {
  const ua = userAgent.toLowerCase();
  const accept = acceptHeader.toLowerCase();
  const wantsMarkdown = accept.includes("text/markdown");

  // text/markdown = definitely a coding agent
  if (wantsMarkdown) {
    // axios = claude code
    if (ua.includes("axios")) {
      return { category: "coding-agent", agent: "claude-code", filtered: false };
    }
    // q= weights in accept = opencode
    if (accept.includes("q=")) {
      return { category: "coding-agent", agent: "opencode", filtered: false };
    }
    // fallback
    return { category: "coding-agent", agent: "unknown-coding-agent", filtered: false };
  }

  // ChatGPT-User = codex (could be browsing, but treating as codex for now)
  if (ua.includes("chatgpt-user")) {
    return { category: "coding-agent", agent: "codex", filtered: false };
  }

  // Browsing agents
  if (ua.includes("claude/1.0") || (ua.includes("claude") && ua.includes("compatible"))) {
    return { category: "browsing-agent", agent: "claude-computer-use", filtered: true };
  }
  if (ua.includes("perplexity-user")) {
    return { category: "browsing-agent", agent: "perplexity-comet", filtered: true };
  }

  // Bots
  if (BOT_PATTERNS.some(pattern => ua.includes(pattern))) {
    return { category: "bot", agent: detectBotName(ua), filtered: true };
  }

  // Preview hosts
  if (PREVIEW_HOST_PATTERNS.some(pattern => host.toLowerCase().includes(pattern))) {
    return { category: "human", agent: "browser", filtered: true };
  }

  return { category: "human", agent: "browser", filtered: false };
}

export function isPageView(accept: string): boolean {
  const a = accept.toLowerCase();
  return a.includes("text/html") || a.includes("text/markdown");
}

// Tests
if (import.meta.main) {
  const tests = [
    {
      name: "claude-code via axios + markdown",
      input: { ua: "axios/1.8.4", accept: "text/markdown, text/html, */*", host: "docs.com" },
      expected: { category: "coding-agent", agent: "claude-code" },
    },
    {
      name: "opencode via accept pattern",
      input: { ua: "Mozilla/5.0 Chrome", accept: "text/plain;q=1.0, text/markdown;q=0.9", host: "docs.com" },
      expected: { category: "coding-agent", agent: "opencode" },
    },
    {
      name: "codex via chatgpt-user",
      input: { ua: "ChatGPT-User/1.0", accept: "text/html", host: "docs.com" },
      expected: { category: "coding-agent", agent: "codex" },
    },
    {
      name: "bot filtered",
      input: { ua: "Googlebot/2.1", accept: "text/html", host: "docs.com" },
      expected: { category: "bot", agent: "googlebot", filtered: true },
    },
    {
      name: "human",
      input: { ua: "Mozilla/5.0 Chrome", accept: "text/html", host: "docs.com" },
      expected: { category: "human", agent: "browser" },
    },
  ];

  let passed = 0;
  for (const test of tests) {
    const result = classify(test.input.ua, test.input.accept, test.input.host);
    const ok = result.category === test.expected.category && result.agent === test.expected.agent;
    console.log(`${ok ? "✓" : "✗"} ${test.name}`);
    if (!ok) {
      console.log(`  expected: ${JSON.stringify(test.expected)}`);
      console.log(`  got: ${JSON.stringify(result)}`);
    } else {
      passed++;
    }
  }
  console.log(`\n${passed}/${tests.length} tests passed`);
}
