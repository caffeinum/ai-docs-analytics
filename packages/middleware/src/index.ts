const DEFAULT_ENDPOINT = "https://ai-docs-analytics-api.theisease.workers.dev/track";
const TIMEOUT_MS = 2500;

export interface TrackOptions {
  host: string;
  path: string;
  userAgent: string;
  accept: string;
  country?: string;
}

export interface TrackResult {
  ok: boolean;
  category?: string;
  agent?: string;
  skipped?: string;
  error?: string;
}

function getEndpoint(): string | null {
  const env = typeof process !== "undefined" ? process.env.AI_ANALYTICS_ENDPOINT : undefined;
  if (env === "") return null;
  return env || DEFAULT_ENDPOINT;
}

function isPageView(accept: string): boolean {
  const a = accept.toLowerCase();
  return a.includes("text/html") || a.includes("text/markdown");
}

export async function trackVisit(options: TrackOptions): Promise<TrackResult> {
  const endpoint = getEndpoint();
  if (!endpoint) {
    return { ok: true, skipped: "disabled" };
  }

  if (!isPageView(options.accept)) {
    return { ok: true, skipped: "not-page-view" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: options.host,
        path: options.path,
        user_agent: options.userAgent,
        accept: options.accept,
        country: options.country || "unknown",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return await response.json();
  } catch (e) {
    clearTimeout(timeoutId);
    return { ok: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}
