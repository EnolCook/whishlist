/**
 * Liens du site que l'app sait ouvrir (feature 011, contracts/links.md). Module pur, repris par l'app :
 * la même table donne les fichiers d'association du domaine (`/.well-known/…`), les filtres d'intention
 * Android de `mobile/app.config.ts` et l'écran de l'app pour une adresse reçue.
 */

/** Identifiant de l'app publiée (iOS et Android). La variante de développement n'est pas associée au domaine. */
export const APP_BUNDLE_ID = "app.ohyoushouldnt.mobile";

/** Schéma propre de l'app : mêmes chemins que le site (`ohyoushouldnt://confirmer-email/…`). */
export const APP_SCHEME = "ohyoushouldnt";

import { internalPath, stripLocalePrefix } from "../i18n/locale-path";
import routes from "./app-link-routes.json";

type Params = Record<string, string>;

export interface AppLinkRoute {
  /** Chemin du site sans préfixe de langue ; `:param` vaut un segment non vide, sans `/`. */
  sitePattern: string;
  /** Chemin de l'écran de l'app, avec les mêmes `:param`. */
  appPattern: string;
  /** Clés de requête transmises à l'écran ; les autres sont ignorées. */
  keepQuery: readonly string[];
}

/**
 * La table vit dans `app-link-routes.json` : `mobile/app.config.ts` la lit aussi, et le chargeur de config
 * d'Expo lit le JSON mais pas un module TypeScript hors de `mobile/`.
 * Pas de `/listes/:id` : l'app ouvre ces pages du site exprès (« Gérer le partage sur le site »),
 * et un lien revendiqué rouvrirait l'app au lieu du navigateur.
 */
export const APP_LINK_ROUTES: readonly AppLinkRoute[] = routes.map((route) => ({
  sitePattern: route.site,
  appPattern: route.app,
  keepQuery: route.keepQuery,
}));

/** `/links/invite/:token` + `{ token }` → `/links/invite/<token>` (paramètres déjà encodés). */
function fillPattern(pattern: string, params: Params): string {
  return pattern.replace(/:([A-Za-z]+)/g, (_match, name: string) => params[name] ?? "");
}

const EN_PREFIX = "/en";

/** `/a/b` → `["a", "b"]` ; un segment vide (`/a//b`) reste vide et ne correspond à aucun motif. */
function segments(path: string): string[] {
  return path === "/" ? [] : path.split("/").slice(1);
}

function decodeSegment(raw: string): string | null {
  try {
    const decoded = decodeURIComponent(raw);
    return decoded === "" || decoded.includes("/") ? null : decoded;
  } catch {
    return null;
  }
}

function parseQuery(search: string): Map<string, string> {
  const query = new Map<string, string>();
  for (const pair of search.split("&")) {
    if (!pair) continue;
    const [rawKey, ...rest] = pair.split("=");
    try {
      const key = decodeURIComponent(rawKey.replace(/\+/g, " "));
      if (!query.has(key)) query.set(key, decodeURIComponent(rest.join("=").replace(/\+/g, " ")));
    } catch {
      // Paire mal encodée : ignorée.
    }
  }
  return query;
}

function matchRoute(route: AppLinkRoute, actual: string[]): Params | null {
  const pattern = segments(route.sitePattern);
  if (actual.length !== pattern.length) return null;
  const params: Params = {};
  for (const [index, part] of pattern.entries()) {
    if (part.startsWith(":")) {
      const value = decodeSegment(actual[index]);
      if (value === null) return null;
      params[part.slice(1)] = encodeURIComponent(value);
    } else if (part !== actual[index]) {
      return null;
    }
  }
  return params;
}

/**
 * Chemin de l'écran de l'app pour une adresse du site, ou `null` si l'app ne la traite pas.
 * Formes acceptées : `http(s)://<apiHost>/…`, `<scheme>://…` (l'hôte est le premier segment),
 * `<scheme>:///…`, ou un chemin seul. Le préfixe `/en` est ignoré : l'app suit la langue du téléphone.
 */
export function appPathForSiteUrl(url: string, options: { apiHost: string; scheme?: string }): string | null {
  const scheme = options.scheme ?? APP_SCHEME;
  let rest: string;
  const web = /^https?:\/\/([^/?#]*)(.*)$/i.exec(url);
  if (web) {
    if (web[1].toLowerCase() !== options.apiHost.toLowerCase()) return null;
    rest = web[2];
  } else if (url.toLowerCase().startsWith(`${scheme.toLowerCase()}://`)) {
    rest = `/${url.slice(scheme.length + 3).replace(/^\/+/, "")}`;
  } else if (internalPath(url)) {
    rest = url;
  } else {
    return null;
  }

  const [beforeHash] = rest.split("#");
  const queryStart = beforeHash.indexOf("?");
  const rawPath = queryStart === -1 ? beforeHash : beforeHash.slice(0, queryStart);
  const search = queryStart === -1 ? "" : beforeHash.slice(queryStart + 1);
  if (rawPath !== "" && !internalPath(rawPath)) return null;
  const path = stripLocalePrefix(rawPath.replace(/\/+$/, "") || "/").path;
  const pathSegments = segments(path);

  for (const route of APP_LINK_ROUTES) {
    const params = matchRoute(route, pathSegments);
    if (!params) continue;
    const query = parseQuery(search);
    const kept = route.keepQuery.flatMap((key) => {
      const value = query.get(key);
      return value ? [`${encodeURIComponent(key)}=${encodeURIComponent(value)}`] : [];
    });
    return kept.length ? `${fillPattern(route.appPattern, params)}?${kept.join("&")}` : fillPattern(route.appPattern, params);
  }
  return null;
}

/** Motif d'un chemin pour le fichier Apple : `:param` → `*`. */
function applePattern(route: AppLinkRoute): string {
  return route.sitePattern.replace(/:[A-Za-z]+/g, "*");
}

function withEnglish(paths: string[]): string[] {
  return [...new Set(paths.flatMap((path) => [path, `${EN_PREFIX}${path}`]))];
}

/** Contenu de `/.well-known/apple-app-site-association` (liens universels iOS). */
export function appleAssociation(teamId: string) {
  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${APP_BUNDLE_ID}`],
          components: withEnglish(APP_LINK_ROUTES.map(applePattern)).map((path) => ({ "/": path })),
        },
      ],
    },
  };
}

const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** Contenu de `/.well-known/assetlinks.json` (App Links Android) ; les empreintes mal formées sont ignorées. */
export function androidAssociation(fingerprints: readonly string[]) {
  const valid = fingerprints.map((value) => value.trim().toUpperCase()).filter((value) => FINGERPRINT.test(value));
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: APP_BUNDLE_ID, sha256_cert_fingerprints: valid },
    },
  ];
}

/** Préfixes des filtres d'intention Android : la partie fixe de chaque chemin, avec et sans `/en`. */
export function androidPathPrefixes(): string[] {
  return withEnglish(APP_LINK_ROUTES.map((route) => route.sitePattern.split(":")[0]));
}
