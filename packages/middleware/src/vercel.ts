import { trackVisit } from "./index";

interface VercelContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

export function withAIAnalytics(
  middleware?: (request: Request, context: VercelContext) => Response | undefined | Promise<Response | undefined>,
) {
  return async (request: Request, context: VercelContext) => {
    const response = middleware
      ? await middleware(request, context)
      : undefined;

    const url = new URL(request.url);
    context.waitUntil(
      trackVisit({
        host: url.hostname,
        path: url.pathname,
        userAgent: request.headers.get("user-agent") || "",
        accept: request.headers.get("accept") || "",
        country: request.headers.get("x-vercel-ip-country") || undefined,
      }).catch(() => {}),
    );

    return response;
  };
}

export { trackVisit } from "./index";
