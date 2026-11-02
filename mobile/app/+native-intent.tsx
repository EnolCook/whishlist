import { setPendingLink } from "@/links/pending";
import { appPathForUrl } from "@/links/routes";

/** Lien d'un partage reçu (`ohyoushouldnt://expo-sharing`) ; un chemin relatif n'en est pas un. */
function isShare(path: string): boolean {
  try {
    return new URL(path).hostname === "expo-sharing";
  } catch {
    return false;
  }
}

/**
 * Adresse reçue par l'app (feature 011) → écran : `/reinitialiser/<jeton>` du site devient
 * `/links/reset-password/<jeton>`. Une adresse inconnue ouvre l'accueil. Ne lève jamais (une erreur ici
 * fait planter l'app) et n'écrit pas l'adresse, qui porte un jeton, dans la console.
 *
 * Un partage reçu d'une autre app (expo-sharing : `…://expo-sharing`) ouvre « Ajouter à une liste ». Il est gardé
 * comme lien en attente : sans session, la connexion y ramène ensuite.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (isShare(path)) {
      setPendingLink("/share");
      return "/share";
    }
    return appPathForUrl(path) ?? "/";
  } catch {
    return "/";
  }
}
