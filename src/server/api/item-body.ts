import type { ItemFields } from "../commands/items";
import { text, type JsonBody } from "./http";

/** Corps `ItemInput` du contrat → champs de la commande. */
export function itemFieldsFrom(wishlistId: string, body: JsonBody, itemId?: string): ItemFields {
  return {
    wishlistId,
    itemId,
    name: text(body.name),
    typeId: text(body.typeId),
    personId: text(body.personId),
    url: text(body.url),
    imageUrl: text(body.imageUrl),
    price: text(body.price),
    priority: text(body.priority),
    // Absent (client antérieur à 1.5.0) : non transmis, la valeur enregistrée est gardée.
    secondHandOk: typeof body.secondHandOk === "boolean" ? body.secondHandOk : undefined,
  };
}
