import type { SharePayload } from "expo-sharing";

/**
 * Faux expo-sharing : `shareAsync` (export des données) et un partage reçu que les tests posent.
 * Comme le module natif, il ne prévient de rien : l'app relit le partage (`getSharedPayloads`) quand elle le veut.
 * `getResolvedSharedPayloadsAsync` (et `useIncomingShare`, qui l'appelle) ouvre l'adresse partagée depuis
 * l'appareil : l'app ne doit pas s'en servir, les tests vérifient qu'il n'est jamais appelé.
 */
let payloads: SharePayload[] = [];

/** Simule un contenu partagé vers l'app (ou `[]` : rien de partagé). */
export function setSharedPayloads(next: SharePayload[]): void {
  payloads = next;
}

export const sharingMock = {
  shareAsync: jest.fn(async () => undefined),
  getSharedPayloads: jest.fn(() => payloads),
  getResolvedSharedPayloadsAsync: jest.fn(async () => []),
  clearSharedPayloads: jest.fn(() => {
    payloads = [];
  }),
  useIncomingShare: jest.fn(() => {
    throw new Error("useIncomingShare fetches the shared URL from the device: use useSharedPayloads");
  }),
};
