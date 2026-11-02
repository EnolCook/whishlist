import { siteOrigin } from "@/api/client";

import { APP_SCHEME, appPathForSiteUrl } from "../../../src/site/app-links";

/**
 * Écran de l'app pour une adresse reçue (lien universel, App Link ou schéma `ohyoushouldnt://`),
 * ou `null` si l'app ne la traite pas. Seules les adresses du serveur de ce build sont reconnues.
 */
export function appPathForUrl(url: string): string | null {
  const host = siteOrigin().replace(/^https?:\/\//, "");
  return appPathForSiteUrl(url, { apiHost: host, scheme: APP_SCHEME });
}
