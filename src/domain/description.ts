/** Longueur maximale de la description d'une idée (même ordre que le mot laissé avec une réservation). */
export const MAX_DESCRIPTION = 2000;

/** Retours à la ligne gardés (le texte s'affiche tel qu'écrit), blancs autour retirés, vide → null. */
export function normalizeDescription(value: string | null | undefined): string | null {
  const text = (value ?? "").replace(/\r\n?/g, "\n").trim();
  return text ? text : null;
}
