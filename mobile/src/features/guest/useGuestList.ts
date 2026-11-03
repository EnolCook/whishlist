import { useCallback, useEffect, useState } from "react";

import { ApiError, NetworkError, type Schemas } from "@/api/client";
import { errorText } from "@/features/errors";
import { appPathForUrl } from "@/links/routes";
import { getSnapshot, listsKey, publicListKey, putSnapshot, removeSnapshot } from "@/offline/snapshot";

import { readGuestList } from "./api";

export type GuestState =
  | { status: "loading" }
  | { status: "locked" }
  /** `fetchedAt` : copie hors ligne d'une liste suivie, lue quand le serveur ne répond pas ; `null` en ligne. */
  | { status: "ready"; list: Schemas["PublicList"]; fetchedAt: string | null }
  | { status: "missing" }
  | { status: "failed"; message: string };

/**
 * Liste vue en invité, relue à l'ouverture (dès que `enabled`) et par `reload` (011, data-model « Écran invité »).
 * Seule une liste suivie (`subscribed`, 012) garde une copie hors ligne, pour la consulter sans réseau.
 * Une liste ouverte par un lien n'en garde pas : une copie des idées libres pousserait à réserver une idée
 * déjà prise. La réservation reste toujours en ligne.
 */
export function useGuestList(readToken: string, enabled = true): { state: GuestState; reload: () => void } {
  const [state, setState] = useState<GuestState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const key = publicListKey(readToken);
    void (async () => {
      try {
        const list = await readGuestList(readToken);
        if (list.subscribed) await putSnapshot(key, list);
        else await removeSnapshot(key);
        if (active) setState({ status: "ready", list, fetchedAt: null });
      } catch (error) {
        if (error instanceof NetworkError) {
          const copy = await getSnapshot<Schemas["PublicList"]>(key);
          if (!active) return;
          if (copy) setState({ status: "ready", list: copy.body, fetchedAt: copy.fetchedAt });
          else setState({ status: "failed", message: errorText(error) });
          return;
        }
        if (error instanceof ApiError && (error.code === "readPasswordRequired" || error.status === 404)) {
          await removeSnapshot(key);
        }
        if (!active) return;
        if (error instanceof ApiError && error.code === "readPasswordRequired") setState({ status: "locked" });
        else if (error instanceof ApiError && error.status === 404) setState({ status: "missing" });
        else setState({ status: "failed", message: errorText(error) });
      }
    })();
    return () => {
      active = false;
    };
  }, [readToken, attempt, enabled]);
  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, reload };
}

/** Liste de ce compte dont le lien public porte ce jeton (copie locale de « Mes listes »), sinon `null`. */
export async function memberListIdFor(readToken: string): Promise<string | null> {
  const lists = await getSnapshot<Schemas["ListSummary"][]>(listsKey);
  const guestPath = `/guest/${encodeURIComponent(readToken)}`;
  return lists?.body.find((list) => appPathForUrl(list.readUrl) === guestPath)?.id ?? null;
}
