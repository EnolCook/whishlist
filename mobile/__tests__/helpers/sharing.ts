import { useSyncExternalStore } from "react";
import type { SharePayload } from "expo-sharing";

/** Faux expo-sharing : `shareAsync` (export des données) et un partage reçu que les tests posent. */
let payloads: SharePayload[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Simule un contenu partagé vers l'app (ou `[]` : rien de partagé). */
export function setSharedPayloads(next: SharePayload[]): void {
  payloads = next;
  emit();
}

function clearSharedPayloads() {
  payloads = [];
  emit();
}

export const sharingMock = {
  shareAsync: jest.fn(async () => undefined),
  getSharedPayloads: () => payloads,
  clearSharedPayloads: jest.fn(clearSharedPayloads),
  useIncomingShare: () => {
    const sharedPayloads = useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => payloads,
    );
    return {
      sharedPayloads,
      resolvedSharedPayloads: [],
      isResolving: false,
      error: null,
      refreshSharePayloads: jest.fn(),
      clearSharedPayloads: sharingMock.clearSharedPayloads,
    };
  },
};
