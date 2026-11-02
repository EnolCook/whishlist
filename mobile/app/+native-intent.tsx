import { appPathForUrl } from "@/links/routes";

/**
 * Adresse reçue par l'app (feature 011) → écran : `/reinitialiser/<jeton>` du site devient
 * `/links/reset-password/<jeton>`. Une adresse inconnue ouvre l'accueil. Ne lève jamais (une erreur ici
 * fait planter l'app) et n'écrit pas l'adresse, qui porte un jeton, dans la console.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return appPathForUrl(path) ?? "/";
  } catch {
    return "/";
  }
}
