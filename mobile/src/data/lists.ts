import { newClientId } from "@/offline/ids";
import type { ListPreview } from "@/offline/outbox";

import { listDefaults, numberedTitle } from "../../../src/domain/list-defaults";

import { write, type WriteResult } from "./write";

export { useMemberList, useMyLists, refreshList, refreshLists } from "./store";

type Translate = (key: string, vars?: Record<string, string>) => string;

/**
 * Valeurs que prend un champ laissé vide, calculées comme sur le site (`src/domain/list-defaults.ts`) :
 * nom du compte, textes du namespace `home` dans la langue de l'app, celle que l'app envoie au serveur.
 * Le nom est numéroté d'après les listes connues du téléphone ; hors ligne, le numéro peut différer de
 * celui que le serveur choisira, et c'est le sien qui reste après l'envoi.
 */
export function newListDefaults(displayName: string, takenTitles: Iterable<string>, t: Translate): ListPreview {
  const defaults = listDefaults(displayName, t);
  return { title: numberedTitle(defaults.titleBase, takenTitles), category: defaults.category, person: defaults.person };
}

/**
 * Crée une liste avec sa première catégorie et son premier « qui » (FR-011). Comme sur le site, aucun
 * champ n'est obligatoire : un champ vide part vide et le serveur lui donne sa valeur par défaut.
 * `preview` (voir `newListDefaults`) ne sert qu'à montrer la liste avant sa création sur le serveur.
 * Les identifiants sont choisis ici (R5) : la liste s'ouvre tout de suite, même hors ligne,
 * et un renvoi ne crée pas de doublon. Le reste est vérifié à l'envoi (FR-041).
 */
export async function createList(
  input: { title: string; category: string; person: string },
  preview: ListPreview,
  retrySeq?: number | null,
  ids = { id: newClientId(), categoryId: newClientId(), personId: newClientId() },
): Promise<WriteResult & { listId: string }> {
  const listId = ids.id;
  const result = await write({ kind: "createList", listId, targetId: listId, payload: { ...input, ...ids, preview } }, retrySeq);
  return { ...result, listId };
}
