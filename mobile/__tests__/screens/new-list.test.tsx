import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import NewList from "../../app/(app)/lists/new";
import { signIn } from "@/auth/session";
import { apiTransport, resetStore } from "@/data/store";
import { i18n } from "@/i18n";
import { listChanges } from "@/offline/outbox";
import { setTransport, stopSync } from "@/offline/sync";

import { fakeFetch, json, me } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

const summary = (id: string, title: string) => ({
  id,
  title,
  subtitle: null,
  coverImageUrl: null,
  theme: {},
  role: "owner",
  itemCount: 0,
  readUrl: `https://ohyoushouldnt.example.test/l/${id}`,
});

beforeEach(async () => {
  await freshDb();
  resetStore();
  setTransport(apiTransport);
  await i18n.changeLanguage("fr");
  fakeFetch({});
  await signIn({ token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user: me });
});

afterEach(() => stopSync());

test("each field shows the value it gets if left empty, as on the site", async () => {
  fakeFetch({ "GET /lists": () => json(200, { lists: [summary("w", "Liste de Alex")] }) });
  await render(<NewList />);
  // Une liste porte déjà le nom par défaut : le suivant est numéroté, comme le fera le serveur.
  await waitFor(() => expect(screen.getByTestId("new-list.title")).toHaveProp("placeholder", "Liste de Alex 2"));
  expect(screen.getByTestId("new-list.category")).toHaveProp("placeholder", "Cadeaux");
  expect(screen.getByTestId("new-list.person")).toHaveProp("placeholder", "Alex");
  expect(screen.getByText("Tout peut être modifié ensuite, dans les réglages de la liste.")).toBeOnTheScreen();
});

test("offline, nothing filled in: the list is created on the phone and opens with the defaults", async () => {
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError("Network request failed");
  });
  await render(<NewList />);
  await fireEvent.press(screen.getByRole("button", { name: "Créer la liste" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  expect(screen.queryByTestId("new-list.error")).toBeNull();
  const [change] = await listChanges();
  expect(change).toMatchObject({
    kind: "createList",
    state: "pending",
    payload: { title: "", category: "", person: "", preview: { title: "Liste de Alex", category: "Cadeaux", person: "Alex" } },
  });
  expect(router.replace).toHaveBeenCalledWith(`/lists/${change!.targetId}`);
});
