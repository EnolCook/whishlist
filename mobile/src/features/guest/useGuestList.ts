import { useCallback, useEffect, useState } from "react";

import { ApiError, type Schemas } from "@/api/client";
import { errorText } from "@/features/errors";
import { appPathForUrl } from "@/links/routes";
import { getSnapshot, listsKey } from "@/offline/snapshot";

import { readGuestList } from "./api";

export type GuestState =
  | { status: "loading" }
  | { status: "locked" }
  | { status: "ready"; list: Schemas["PublicList"] }
  | { status: "missing" }
  | { status: "failed"; message: string };

/**
 * Liste vue en invité, relue à l'ouverture (dès que `enabled`) et par `reload` (011, data-model « Écran invité »).
 * Rien n'est gardé hors ligne : une copie des idées libres pousserait à réserver une idée déjà prise.
 */
export function useGuestList(readToken: string, enabled = true): { state: GuestState; reload: () => void } {
  const [state, setState] = useState<GuestState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      try {
        const list = await readGuestList(readToken);
        if (active) setState({ status: "ready", list });
      } catch (error) {
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
