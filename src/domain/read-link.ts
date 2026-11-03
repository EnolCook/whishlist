import { stripLocalePrefix } from "../i18n/locale-path";
import { APP_SCHEME } from "../site/app-links";

/*
 * Lien de lecture d'une liste collé ou scanné (012). Module pur, sans dépendance au serveur :
 * l'app mobile l'utilise aussi pour filtrer un QR code scanné avant tout appel.
 */

const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const APP_SCHEME_PREFIX = `${APP_SCHEME}://`;
/** Un nom d'hôte (avec un point, ou `localhost`) suivi d'un chemin : lien collé sans `https://`. */
const HOST_FIRST_PATTERN = /^(?:localhost|[a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d+)?\//i;

/**
 * Extrait un `readToken` de ce qu'une personne colle : lien complet (`https://.../l/<token>`,
 * `https://.../en/l/<token>`, schéma en majuscules), lien sans schéma (`ohyoushouldnt.app/l/<token>`),
 * lien de l'app (`ohyoushouldnt://l/<token>`), chemin (`/l/<token>`), sous-page de la liste
 * (`/l/<token>/reserver?…`) ou jeton brut.
 * Retourne `null` si l'entrée ne correspond pas à un lien de lecture de liste.
 */
export function extractReadToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (RAW_TOKEN_PATTERN.test(trimmed)) return trimmed;

  let pathname: string;
  if (trimmed.toLowerCase().startsWith(APP_SCHEME_PREFIX)) {
    // `ohyoushouldnt://l/<token>` : pour `URL`, `l` serait l'hôte ; les chemins sont ceux du site.
    pathname = `/${trimmed.slice(APP_SCHEME_PREFIX.length)}`;
  } else if (/^https?:\/\//i.test(trimmed) || HOST_FIRST_PATTERN.test(trimmed)) {
    try {
      pathname = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).pathname;
    } catch {
      return null;
    }
  } else {
    pathname = trimmed;
  }

  const { path } = stripLocalePrefix(pathname.split(/[?#]/)[0]);
  const match = /^\/l\/([A-Za-z0-9_-]{8,128})(?:\/.*)?$/.exec(path);
  return match ? match[1] : null;
}
