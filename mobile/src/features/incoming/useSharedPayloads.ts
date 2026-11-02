import { clearSharedPayloads, getSharedPayloads, type SharePayload } from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

const key = (payloads: readonly SharePayload[]) => JSON.stringify(payloads.map((p) => [p.shareType, p.mimeType, p.value]));

/**
 * Contenus partagés vers l'app, lus tels quels (`getSharedPayloads`, synchrone, sans réseau).
 *
 * Pas `useIncomingShare` d'expo-sharing : il appelle aussi `getResolvedSharedPayloadsAsync`, qui ouvre l'adresse
 * partagée depuis l'appareil (une requête vers la boutique, avec l'IP de la personne) à chaque retour au premier plan.
 * L'app n'en a pas besoin : « Remplir depuis le lien » passe par le serveur. Relu au montage et à chaque retour au
 * premier plan (un nouveau partage alors que l'écran est déjà ouvert).
 */
export function useSharedPayloads(): { payloads: SharePayload[]; clear: () => void } {
  const [payloads, setPayloads] = useState<SharePayload[]>(read);

  useEffect(() => {
    const refresh = () => {
      const next = read();
      setPayloads((current) => (key(current) === key(next) ? current : next));
    };
    refresh();
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") refresh();
    });
    return () => subscription.remove();
  }, []);

  const clear = useCallback(() => {
    try {
      clearSharedPayloads();
    } catch {
      // Rien à effacer, ou module absent : le partage n'est de toute façon plus affiché.
    }
    setPayloads([]);
  }, []);

  return { payloads, clear };
}

function read(): SharePayload[] {
  try {
    return getSharedPayloads();
  } catch {
    return [];
  }
}
