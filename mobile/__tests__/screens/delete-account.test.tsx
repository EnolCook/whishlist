import NetInfo, { NetInfoStateType } from "@react-native-community/netinfo";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import DeleteAccount from "../../app/(app)/delete-account";
import { getSession, signIn } from "@/auth/session";
import { usePendingCount } from "@/data/store";
import { i18n } from "@/i18n";
import { watchNetwork } from "@/network";
import { enqueue, listChanges } from "@/offline/outbox";
import { getSnapshot, putSnapshot } from "@/offline/snapshot";

import { fakeFetch, json, me } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("@/data/store", () => ({ ...jest.requireActual("@/data/store"), usePendingCount: jest.fn(() => 0) }));

const preview = {
  deletedLists: ["Un", "Deux", "Trois", "Quatre", "Cinq", "Six", "Sept"].map((title, index) => ({ id: `d${index}`, title })),
  transferredLists: [{ id: "w", title: "Nos envies toute l'année", newOwnerName: "Camille" }],
  reservationsKept: 1,
  followedLists: [{ id: "f", title: "Les envies de Sacha" }],
};

beforeEach(async () => {
  await freshDb();
  await i18n.changeLanguage("fr");
  jest.mocked(usePendingCount).mockReturnValue(0);
  fakeFetch({});
  await signIn({ token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user: me });
});

async function confirmWith(password: string) {
  await fireEvent.changeText(await screen.findByLabelText("Mot de passe actuel"), password);
  await fireEvent.press(screen.getByRole("button", { name: "Supprimer définitivement mon compte" }));
}

test("the preview shows the counts and at most 5 titles per group", async () => {
  fakeFetch({ "GET /me/deletion": () => json(200, preview) });
  await render(<DeleteAccount />);
  expect(await screen.findByText("Cette action est définitive.")).toBeOnTheScreen();
  expect(screen.getByText(/^7 listes dont personne d'autre/)).toBeOnTheScreen();
  expect(screen.getByText("• Cinq")).toBeOnTheScreen();
  expect(screen.queryByText("• Six")).toBeNull();
  expect(screen.getByText("• et 2 de plus")).toBeOnTheScreen();
  expect(screen.getByText("• Nos envies toute l'année → Camille en devient propriétaire")).toBeOnTheScreen();
  expect(screen.getByText(/^1 cadeau que vous avez réservé reste réservé/)).toBeOnTheScreen();
  expect(screen.getByText("Vous ne suivrez plus 1 liste :")).toBeOnTheScreen();
  expect(screen.getByText("• Les envies de Sacha")).toBeOnTheScreen();
});

test("with changes never sent, the FR-016 warning shows", async () => {
  jest.mocked(usePendingCount).mockReturnValue(2);
  fakeFetch({ "GET /me/deletion": () => json(200, preview) });
  await render(<DeleteAccount />);
  expect(await screen.findByText("2 changements jamais envoyés seront perdus.")).toBeOnTheScreen();
});

test("wrong password: translated message, empty field, still signed in", async () => {
  fakeFetch({
    "GET /me/deletion": () => json(200, preview),
    "POST /me/deletion": () => json(400, { error: { code: "wrongCurrentPassword", message: "x" } }),
  });
  await render(<DeleteAccount />);
  await confirmWith("pas-le-bon");
  expect(await screen.findByText(i18n.t("errors:wrongCurrentPassword"))).toBeOnTheScreen();
  expect(screen.getByLabelText("Mot de passe actuel").props.value).toBe("");
  expect(getSession().status).toBe("signedIn");
});

test("204: secure storage, SQLite and export files are emptied, signed out with deleted", async () => {
  const cache: Map<string, string> = jest.requireMock("expo-file-system").__cache;
  cache.set("ohyoushouldnt-donnees-2026-10-28.json", "{}");
  await putSnapshot("lists", { lists: [] });
  await enqueue({
    kind: "createList",
    listId: "new-list-id-00001",
    targetId: "new-list-id-00001",
    payload: { id: "new-list-id-00001", title: "Anniversaire", category: "Jeux", person: "Lou", categoryId: "c-new-list-00001", personId: "p-new-list-00001" },
  });
  const bodies: unknown[] = [];
  fakeFetch({
    "GET /me/deletion": () => json(200, preview),
    "POST /me/deletion": async (request) => {
      bodies.push(await request.json());
      return new Response(null, { status: 204 });
    },
  });
  await render(<DeleteAccount />);
  await confirmWith("demo-password-1");
  await waitFor(() => expect(getSession()).toEqual({ status: "signedOut", expired: false, deleted: true }));
  expect(bodies).toEqual([{ password: "demo-password-1" }]);
  expect(await SecureStore.getItemAsync("session.token")).toBeNull();
  expect(await SecureStore.getItemAsync("session.userId")).toBeNull();
  expect(await getSnapshot("lists")).toBeNull();
  expect(await listChanges()).toEqual([]);
  expect(cache.size).toBe(0);
});

// Dernier : le réseau reste coupé pour la suite du fichier.
test("offline: no form, the offline message", async () => {
  fakeFetch({ "GET /me/deletion": () => json(200, preview) });
  watchNetwork();
  const listener = jest.mocked(NetInfo.addEventListener).mock.calls[0][0];
  await render(<DeleteAccount />);
  await screen.findByLabelText("Mot de passe actuel");
  listener({ isConnected: false, isInternetReachable: false, type: NetInfoStateType.none, details: null, isWifiEnabled: false });
  expect(await screen.findByText(i18n.t("mobile:offline.needsNetwork"))).toBeOnTheScreen();
  expect(screen.queryByLabelText("Mot de passe actuel")).toBeNull();
});
