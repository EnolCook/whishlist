import { router, type Href } from "expo-router";
import { useRef, useState } from "react";

import { saveItem } from "@/data/items";

import type { Draft } from "./ItemForm";

/**
 * Enregistrement d'une idée depuis le formulaire. Accepté ou mis en attente (hors ligne) :
 * retour à la liste. Refusé : l'erreur reste sous le formulaire, et le prochain envoi
 * reprend le même changement (« Corriger ») au lieu d'en créer un autre.
 *
 * Le retour se fait en arrière s'il y a un écran derrière ; sinon (app ouverte sur le formulaire, par un
 * partage reçu à froid) ou avec `toList`, on remplace le formulaire par l'écran de la liste. Une fois
 * l'idée acceptée, un nouvel envoi est ignoré : pas de doublon si l'on tape deux fois.
 */
export function useItemSave(
  listId: string,
  options: { itemId?: string; create?: boolean; retrySeq?: number | null; errorCode?: string | null; toList?: boolean } = {},
) {
  const [error, setError] = useState<string | null>(options.errorCode ?? null);
  const [retrySeq, setRetrySeq] = useState<number | null>(options.retrySeq ?? null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const saved = useRef(false);

  async function submit(draft: Draft) {
    if (pending.current || saved.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await saveItem(listId, draft, { itemId: options.itemId, create: options.create, retrySeq });
      if (result.ok) {
        saved.current = true;
        if (!options.toList && router.canGoBack()) router.back();
        else router.replace(`/lists/${listId}` as Href);
        return;
      }
      setError(result.error);
      setRetrySeq(result.seq);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return { error, busy, submit };
}
