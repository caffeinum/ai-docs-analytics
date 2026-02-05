import { NextResponse, type NextFetchEvent } from "next/server";
import type { NextRequest, NextMiddleware } from "next/server";
import { trackVisit } from "./index";

export function withAIAnalytics(middleware?: NextMiddleware): NextMiddleware {
  return async (request: NextRequest, event: NextFetchEvent) => {
    const response = middleware
      ? await middleware(request, event)
      : NextResponse.next();

    event.waitUntil(
      trackVisit({
        host: request.headers.get("host") || request.nextUrl.host,
        path: request.nextUrl.pathname,
        userAgent: request.headers.get("user-agent") || "",
        accept: request.headers.get("accept") || "",
        country: request.geo?.country || "unknown",
      }).catch(() => {}),
    );

    return response;
  };
}

export { trackVisit } from "./index";
