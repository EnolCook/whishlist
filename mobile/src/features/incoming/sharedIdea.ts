import type { SharePayload } from "expo-sharing";

/** Ce qu'un partage propose pour une nouvelle idée : un lien, et le texte autour comme nom. */
export type SharedIdea = { url: string; name: string };

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
/** Ponctuation collée au lien dans une phrase (« … ici : https://x.fr/a). ») : pas une partie de l'adresse. */
const URL_TAIL = /[).,;:!?»”'"]+$/;
/** Séparateurs laissés autour du nom une fois le lien retiré (« Lampe – https://… », « "Lampe" | Boutique »). */
const EDGES = /^[\s\-–—|:,;"'«“”»]+|[\s\-–—|:,;"'«“”»]+$/g;
const MAX_NAME = 200;
/** Au-delà, ce n'est plus l'adresse d'une page de cadeau (un lien de suivi, des données collées) : on l'ignore. */
const MAX_URL = 2048;

/** Le serveur n'accepte que `http://` et `https://` en minuscules : « HTTPS://… » est ramené à cette forme. */
function normalizeScheme(url: string): string {
  return url.replace(/^https?/i, (scheme) => scheme.toLowerCase());
}

/**
 * Lit les contenus partagés : le premier lien http(s) (d'un partage d'URL ou trouvé dans un texte, schéma en
 * minuscules, ignoré au-delà de 2048 caractères),
 * et le reste du texte, nettoyé, comme nom proposé. Rend null s'il n'y a ni lien ni texte (image seule…).
 */
export function sharedIdea(payloads: readonly SharePayload[]): SharedIdea | null {
  let url = "";
  const texts: string[] = [];
  for (const payload of payloads) {
    if (payload.shareType && payload.shareType !== "text" && payload.shareType !== "url") continue;
    const value = (payload.value ?? "").trim();
    if (!value) continue;
    const found = url ? null : URL_PATTERN.exec(value);
    if (found) {
      const candidate = normalizeScheme(found[0].replace(URL_TAIL, ""));
      if (candidate.length <= MAX_URL) url = candidate;
      texts.push(value.replace(found[0], " "));
    } else {
      texts.push(value);
    }
  }
  const name = texts.join(" ").replace(/\s+/g, " ").replace(EDGES, "").trim().slice(0, MAX_NAME);
  if (!url && !name) return null;
  return { url, name };
}
