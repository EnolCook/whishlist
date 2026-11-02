import { NextResponse, type NextRequest } from "next/server";
import { localeCookie } from "@/src/i18n/config";
import { decideLocaleRoute } from "@/src/i18n/locale-path";
import { contentSecurityPolicy } from "@/src/server/content-security";
import { legacyHostRedirect } from "@/src/site/seo";

function cspHeaders(request: NextRequest) {
  const policy = contentSecurityPolicy({ dev: process.env.NODE_ENV === "development" });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", policy.nonce);
  requestHeaders.set("Content-Security-Policy", policy.value);
  return { requestHeaders, value: policy.value };
}

function withLocaleCookie(response: NextResponse, request: NextRequest, locale: "fr" | "en") {
  response.cookies.set(localeCookie, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
}

/** L'adresse porte la langue (pas pour `/api/`, qui suit `Accept-Language`). Le français n'a pas de préfixe, l'anglais est sous `/en`. */
export function proxy(request: NextRequest) {
  const { requestHeaders, value } = cspHeaders(request);
  const moved = legacyHostRedirect(
    request.headers.get("host"),
    request.nextUrl.pathname,
    request.nextUrl.search,
  );
  if (moved) {
    const response = NextResponse.redirect(moved, 301);
    response.headers.set("Content-Security-Policy", value);
    return response;
  }

  const decision = decideLocaleRoute({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    nextUrl: request.headers.get("next-url"),
  });

  if (decision.type === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    url.search = decision.search;
    const response = NextResponse.redirect(url, decision.status);
    response.headers.set("Content-Security-Policy", value);
    withLocaleCookie(response, request, decision.locale);
    return response;
  }

  requestHeaders.set("x-locale", decision.locale);
  const response =
    decision.type === "rewrite"
      ? NextResponse.rewrite(
          (() => {
            const url = request.nextUrl.clone();
            url.pathname = decision.pathname;
            url.search = decision.search;
            return url;
          })(),
          { request: { headers: requestHeaders } },
        )
      : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", value);
  withLocaleCookie(response, request, decision.locale);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/|\\.well-known/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
