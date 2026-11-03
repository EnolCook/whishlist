import { parsePriority } from "./priority";
import { listItems } from "./read";
import type { Database, Item } from "./types";

export const BUDGETS = [
  { id: "under-20", label: "Moins de 20 €" },
  { id: "20-50", label: "20 à 50 €" },
  { id: "50-100", label: "50 à 100 €" },
  { id: "over-100", label: "Plus de 100 €" },
  { id: "none", label: "Sans prix" },
] as const;

export type BudgetId = (typeof BUDGETS)[number]["id"];

export function parseBudget(value: string | undefined): BudgetId | null {
  if (!value) return null;
  return BUDGETS.some((budget) => budget.id === value) ? (value as BudgetId) : null;
}

/** Tri après filtres : ★★★★★ d'abord, sans priorité en bas. */
export function sortByPriority(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const pa = parsePriority(a.priority) ?? 0;
    const pb = parsePriority(b.priority) ?? 0;
    return pb - pa || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
  });
}

export interface CategoryGroup {
  typeId: string;
  label: string;
  items: Item[];
}

/** Groupes par type, dans l’ordre des catégories (sortOrder) puis libellé. */
export function groupByCategory(
  items: Item[],
  types: { id: string; label: string; sortOrder?: number }[],
): CategoryGroup[] {
  const typeById = new Map(types.map((type) => [type.id, type]));
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const bucket = groups.get(item.typeId) ?? [];
    bucket.push(item);
    groups.set(item.typeId, bucket);
  }
  return [...groups.entries()]
    .map(([typeId, groupItems]) => ({
      typeId,
      label: typeById.get(typeId)?.label ?? typeId,
      items: groupItems,
    }))
    .sort((a, b) => {
      const orderA = typeById.get(a.typeId)?.sortOrder ?? 0;
      const orderB = typeById.get(b.typeId)?.sortOrder ?? 0;
      return orderA - orderB || a.label.localeCompare(b.label, "fr");
    });
}

export function categoryAnchorId(typeId: string): string {
  return `cat-${typeId.replace(/:/g, "-")}`;
}

export function applyBudget(items: Item[], budget: BudgetId | null): Item[] {
  if (!budget) return items;
  return items.filter((item) => matchesBudget(item.priceCents, budget));
}

export function matchesBudget(cents: number | null, budget: BudgetId): boolean {
  if (budget === "none") return cents === null;
  if (cents === null) return false;
  if (budget === "under-20") return cents < 2000;
  if (budget === "20-50") return cents >= 2000 && cents < 5000;
  if (budget === "50-100") return cents >= 5000 && cents <= 10000;
  return cents > 10000;
}

/**
 * Filtre et tri des idées d'une liste publique telles que l'API les rend (app mobile).
 * L'API les rend déjà dans l'ordre du propriétaire (`sortOrder`) : le tri, stable, ne compare que la
 * priorité, pour garder cet ordre à priorité égale comme `sortByPriority` sur le site.
 */
export function filterAndSortPublicItems<
  T extends { personId: string; priceCents: number | null; priority: string | null },
>(items: readonly T[], personId: string | null, budget: BudgetId | null): T[] {
  return items
    .filter(
      (item) =>
        (!personId || item.personId === personId) &&
        (!budget || matchesBudget(item.priceCents, budget)),
    )
    .sort((a, b) => (parsePriority(b.priority) ?? 0) - (parsePriority(a.priority) ?? 0));
}

export function applyPerson(items: Item[], personId: string | null): Item[] {
  if (!personId) return items;
  return items.filter((item) => item.personId === personId);
}

export function applyView(doc: Database, wishlistId: string, viewId: string | null): Item[] {
  const items = listItems(doc, wishlistId);
  if (!viewId) return items;
  const view = doc.views.find((v) => v.id === viewId && v.wishlistId === wishlistId);
  if (!view || view.kind === "all") return items;
  if (view.kind === "types") return items.filter((item) => view.typeIds.includes(item.typeId));
  if (view.kind === "person" && view.personId) {
    return items.filter((item) => item.personId === view.personId);
  }
  return items;
}
