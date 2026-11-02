import type { SharePayload } from "expo-sharing";

/** Ce qu'un partage propose pour une nouvelle idée : un lien, et le texte autour comme nom. */
export type SharedIdea = { url: string; name: string };

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
/** Ponctuation collée au lien dans une phrase (« … ici : https://x.fr/a). ») : pas une partie de l'adresse. */
const URL_TAIL = /[).,;:!?»”'"]+$/;
/** Séparateurs laissés autour du nom une fois le lien retiré (« Lampe – https://… », « "Lampe" | Boutique »). */
const EDGES = /^[\s\-–—|:,;"'«“”»]+|[\s\-–—|:,;"'«“”»]+$/g;
const MAX_NAME = 200;

/**
 * Lit les contenus partagés : le premier lien http(s) (d'un partage d'URL ou trouvé dans un texte),
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
      url = found[0].replace(URL_TAIL, "");
      texts.push(value.replace(found[0], " "));
    } else {
      texts.push(value);
    }
  }
  const name = texts.join(" ").replace(/\s+/g, " ").replace(EDGES, "").trim().slice(0, MAX_NAME);
  if (!url && !name) return null;
  return { url, name };
}
