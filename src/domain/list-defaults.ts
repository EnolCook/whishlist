/** Nom par défaut d'une liste, numéroté pour rester unique chez un même compte. */
export function numberedTitle(base: string, existing: Iterable<string>): string {
  const taken = new Set<string>();
  for (const title of existing) taken.add(title.trim().toLocaleLowerCase());
  if (!taken.has(base.trim().toLocaleLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.trim().toLocaleLowerCase())) return candidate;
  }
}

/** Titres des listes dont ce compte est membre (propriétaire ou non), pour numéroter un nom par défaut. */
export function memberListTitles(
  memberships: readonly { userId: string; wishlistId: string }[],
  wishlists: readonly { id: string; title: string }[],
  userId: string,
): string[] {
  const byId = new Map(wishlists.map((w) => [w.id, w.title]));
  return memberships
    .filter((m) => m.userId === userId)
    .map((m) => byId.get(m.wishlistId))
    .filter((title): title is string => typeof title === "string");
}

type Translate = (key: string, vars?: Record<string, string>) => string;

/**
 * Valeurs prises par les champs laissés vides à la création d'une liste. Partagé par la page
 * (placeholders) et par la commande, pour que ce qui est affiché soit ce qui est créé.
 * Un nom affiché vide (possible pour un compte importé de l'ancien format) a ses propres libellés.
 */
export function listDefaults(
  displayName: string,
  t: Translate,
): { titleBase: string; category: string; person: string } {
  const name = displayName.trim();
  return {
    titleBase: name ? t("newList.defaultName", { name }) : t("newList.defaultNameNoName"),
    category: t("newList.defaultCategory"),
    person: name || t("newList.defaultPerson"),
  };
}
