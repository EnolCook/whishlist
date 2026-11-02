import { useLocalSearchParams, type Href } from "expo-router";
import { useEffect } from "react";

import { appPathForUrl } from "./routes";

/**
 * Lien qui demande d'être connecté (invitation), gardé pendant la connexion ou l'inscription (feature 011, R5).
 * En mémoire : après un arrêt de l'app, la personne rouvre le lien. Le dernier lien ouvert gagne.
 * Les gardes de session le lisent pendant le rendu (sans le vider) ; l'écran du lien l'efface en arrivant.
 */
let pending: string | null = null;

export function setPendingLink(path: string): void {
  pending = path;
}

/** Où aller une fois la session ouverte : le lien en attente, sinon l'accueil. */
export function afterSignIn(): Href {
  return (pending ?? "/") as Href;
}

export function clearPendingLink(): void {
  pending = null;
}

/**
 * Connexion ou inscription ouvertes par `/connexion?next=/inviter/…` (lien du site) : l'invitation est gardée,
 * comme si son lien avait été ouvert. Les autres valeurs de `next` sont ignorées.
 */
export function useNextLink(): void {
  const { next } = useLocalSearchParams<{ next?: string }>();
  useEffect(() => {
    if (typeof next !== "string" || !next.startsWith("/inviter/")) return;
    const path = appPathForUrl(next);
    if (path) setPendingLink(path);
  }, [next]);
}
