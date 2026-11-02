import { getInstanceSupportUrl } from "@/src/site/instance-content";

/** Liens publics (self-host, soutien). */
export const GITHUB_REPO_URL = "https://github.com/cloeduc/whishlist";

/**
 * Payment Link Stripe (ex. https://buy.stripe.com/…).
 * Priorite : instance-content.json, puis SUPPORT_URL / WHISHLIST_SUPPORT_URL.
 * Lu cote serveur uniquement — pas besoin de NEXT_PUBLIC_.
 */
export function supportUrl(): string | null {
  const fromInstance = getInstanceSupportUrl();
  if (fromInstance) return fromInstance;
  const raw = (process.env.SUPPORT_URL ?? process.env.WHISHLIST_SUPPORT_URL)?.trim();
  return raw && raw.startsWith("http") ? raw : null;
}

/** Adresse `https://` d'une variable, sinon `null`. */
function httpsUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value && value.startsWith("https://") ? value : null;
}

/** Fiche de l'app sur l'App Store (`APP_STORE_URL`), proposée par l'icône du site sur un téléphone (011). */
export function appStoreUrl(): string | null {
  return httpsUrl(process.env.APP_STORE_URL);
}

/** Fiche de l'app sur Google Play (`PLAY_STORE_URL`). */
export function playStoreUrl(): string | null {
  return httpsUrl(process.env.PLAY_STORE_URL);
}
