import { currentLocale } from "@/i18n";
import type { ViewItem } from "@/offline/optimistic";

import type { Draft } from "./ItemForm";

/** Prix en centimes → saisie (« 24,90 » en français), relu par le serveur avec `parsePrice`. */
function priceInput(cents: number | null): string {
  if (cents === null) return "";
  const text = (cents / 100).toFixed(2);
  return currentLocale() === "fr" ? text.replace(".", ",") : text;
}

/** Brouillon d'une idée existante pour le formulaire de modification. */
export function draftOf(item: ViewItem): Draft {
  return {
    name: item.name,
    typeId: item.typeId,
    personId: item.personId,
    url: item.url ?? "",
    imageUrl: item.imageUrl ?? "",
    price: priceInput(item.priceCents),
    priority: item.priority ?? "",
    secondHandOk: item.secondHandOk ?? false,
  };
}

/** Un refus se corrige dans le formulaire seulement s'il porte sur les champs de l'idée. */
export function fixableInForm(item: ViewItem): boolean {
  return item.rejected?.kind === "createItem" || item.rejected?.kind === "updateItem";
}
