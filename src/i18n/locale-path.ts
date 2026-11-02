import { isLocale, type Locale } from "./config";

export function stripLocalePrefix(pathname: string): { locale: Locale; path: string } {
  if (pathname === "/en" || pathname === "/en/") return { locale: "en", path: "/" };
  if (pathname.startsWith("/en/")) return { locale: "en", path: pathname.slice(3) || "/" };
  if (pathname === "/fr" || pathname === "/fr/") return { locale: "fr", path: "/" };
  if (pathname.startsWith("/fr/")) return { locale: "fr", path: pathname.slice(3) || "/" };
  return { locale: "fr", path: pathname || "/" };
}

/** Préfixe anglais uniquement. Le français canonique n'a pas de préfixe. */
export function withLocale(locale: Locale, pathname: string): string {
  const bare = stripLocalePrefix(pathname).path;
  if (!bare.startsWith("/") || bare.startsWith("//")) return pathname;
  if (locale === "fr") return bare;
  return bare === "/" ? "/en" : `/en${bare}`;
}

export type LocaleDecision =
  | { type: "redirect"; status: 301 | 307; pathname: string; search: string; locale: Locale }
  | { type: "rewrite"; pathname: string; search: string; locale: Locale }
  | { type: "continue"; locale: Locale };

/** Chemin interne du site (`/inviter/…`), jamais une autre origine (`//hote`, `/\\hote`, `https://…`). */
export function internalPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}

function pathOnly(value: string | null): string | null {
  if (!value) return null;
  return internalPath(value.split("?")[0]?.split("#")[0] ?? "");
}

/**
 * L'adresse décide de la langue. `?lang=` et `/fr` redirigent vers l'URL canonique.
 * Une navigation interne depuis `/en` garde le préfixe.
 */
export function decideLocaleRoute(input: {
  pathname: string;
  search: string;
  nextUrl: string | null;
}): LocaleDecision {
  const params = new URLSearchParams(input.search.startsWith("?") ? input.search.slice(1) : input.search);
  const lang = params.get("lang");
  if (isLocale(lang)) {
    params.delete("lang");
    const bare = stripLocalePrefix(input.pathname).path;
    const query = params.toString();
    return {
      type: "redirect",
      status: 301,
      pathname: withLocale(lang, bare),
      search: query ? `?${query}` : "",
      locale: lang,
    };
  }

  const current = stripLocalePrefix(input.pathname);
  if (input.pathname === "/fr" || input.pathname === "/fr/" || input.pathname.startsWith("/fr/")) {
    return {
      type: "redirect",
      status: 301,
      pathname: current.path,
      search: input.search,
      locale: "fr",
    };
  }

  if (current.locale === "en") {
    return { type: "rewrite", pathname: current.path, search: input.search, locale: "en" };
  }

  const fromNavigation = pathOnly(input.nextUrl);
  if (fromNavigation && stripLocalePrefix(fromNavigation).locale === "en") {
    return {
      type: "redirect",
      status: 307,
      pathname: withLocale("en", current.path),
      search: input.search,
      locale: "en",
    };
  }

  return { type: "continue", locale: "fr" };
}
