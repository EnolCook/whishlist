import { stripLocalePrefix } from "@/src/i18n/locale-path";

/** Lien d'e-mail affichable en dev : une page de ce site (`origin`) dont le chemin commence par `page`. */
export function isSiteLink(url: string | null | undefined, origin: string, page: string): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.origin === new URL(origin).origin && stripLocalePrefix(parsed.pathname).path.startsWith(page);
  } catch {
    return false;
  }
}
