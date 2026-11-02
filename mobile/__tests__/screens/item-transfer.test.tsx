import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import Transfer from "../../app/(app)/lists/[listId]/items/transfer";
import type { Schemas } from "@/api/client";
import { apiTransport, resetStore } from "@/data/store";
import { ListProvider } from "@/features/lists/ListContext";
import { i18n } from "@/i18n";
import { putSnapshot } from "@/offline/snapshot";
import { setTransport, stopSync } from "@/offline/sync";

import { fakeFetch, json } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ itemId: "gift" }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

const gift: Schemas["MemberItem"] = {
  id: "gift",
  name: "Lampe",
  typeId: "t-books",
  personId: "p-alex",
  url: null,
  imageUrl: null,
  priceCents: 3900,
  priceLabel: "39,00 €",
  priority: null,
  archived: false,
  sortOrder: 0,
};

const base = {
  subtitle: null,
  coverImageUrl: null,
  theme: {},
  role: "owner" as const,
  readUrl: "https://ohyoushouldnt.example.test/l/rt",
  inviteUrl: "https://ohyoushouldnt.example.test/i/it",
  hasReadPassword: false,
  reservations: [],
  members: [],
};
const ideas: Schemas["MemberList"] = {
  ...base,
  id: "w",
  title: "Idées cadeaux",
  categories: [
    { id: "t-books", label: "Livres", sortOrder: 0 },
    { id: "t-misc", label: "Divers", sortOrder: 1 },
  ],
  people: [{ id: "p-alex", label: "Alex" }],
  items: [gift],
};
const christmas: Schemas["MemberList"] = {
  ...base,
  id: "w2",
  title: "Noël",
  categories: [
    { id: "t2-games", label: "Jeux", sortOrder: 0 },
    { id: "t2-misc", label: "Divers", sortOrder: 1 },
  ],
  people: [
    { id: "p2-sam", label: "Sam" },
    { id: "p2-alex", label: " alex " },
  ],
  items: [],
};
const summary = (list: Schemas["MemberList"]): Schemas["ListSummary"] => ({
  id: list.id,
  title: list.title,
  subtitle: null,
  coverImageUrl: null,
  theme: {},
  role: "owner",
  itemCount: list.items.length,
  readUrl: list.readUrl,
});

function routes(extra: Parameters<typeof fakeFetch>[0] = {}) {
  return fakeFetch({
    "GET /lists/w": () => json(200, ideas),
    "GET /lists/w2": () => json(200, christmas),
    "GET /lists": () => json(200, { lists: [summary(ideas), summary(christmas)] }),
    ...extra,
  });
}

async function renderScreen() {
  await render(
    <ListProvider listId="w">
      <Transfer />
    </ListProvider>,
  );
  await screen.findByTestId("item-transfer.screen");
}

beforeEach(async () => {
  await freshDb();
  resetStore();
  setTransport(apiTransport);
  await i18n.changeLanguage("fr");
  await putSnapshot("list:w", ideas);
  jest.mocked(router.dismissTo).mockClear();
});

afterEach(() => stopSync());

test("move: target list preselected, same-name « qui » matched, missing category falls back; sends without the preview", async () => {
  const bodies: Record<string, unknown>[] = [];
  routes({
    "POST /lists/w/items/gift/move": async (request) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return json(200, { ...gift, typeId: "t2-games", personId: "p2-alex" });
    },
  });
  await renderScreen();
  // « Livres » n'existe pas dans Noël : première catégorie ; « Alex » y est (casse et espaces ignorés).
  await waitFor(() => expect(screen.getByLabelText(i18n.t("list:form.type"))).toHaveTextContent("Jeux"));
  expect(screen.getByLabelText(i18n.t("list:form.person"))).toHaveTextContent("alex");
  expect(screen.getByLabelText(i18n.t("list:transfer.target"))).toHaveTextContent("Noël");
  await fireEvent.press(screen.getByTestId("item-transfer.submit"));
  await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith("/lists/w"));
  expect(bodies).toEqual([{ targetListId: "w2", typeId: "t2-games", personId: "p2-alex" }]);
});

test("a refused move (reserved idea) shows the reason and stays on the screen", async () => {
  routes({
    "POST /lists/w/items/gift/move": () => json(400, { error: { code: "itemReservedCannotMove", message: "x" } }),
  });
  await renderScreen();
  await waitFor(() => expect(screen.getByTestId("item-transfer.submit")).toBeEnabled());
  await fireEvent.press(screen.getByTestId("item-transfer.submit"));
  expect(await screen.findByTestId("item-transfer.error")).toHaveTextContent(i18n.t("errors:itemReservedCannotMove"));
  expect(router.dismissTo).not.toHaveBeenCalled();
});

test("copy into the same list: offered as « (cette liste) », sent with a client id, category kept by name", async () => {
  const bodies: Record<string, unknown>[] = [];
  routes({
    "POST /lists/w/items/gift/copy": async (request) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      return json(201, { ...gift, id: body.id });
    },
  });
  await renderScreen();
  await fireEvent.press(screen.getByTestId("tab-copy"));
  await fireEvent.press(screen.getByLabelText(i18n.t("list:transfer.target")));
  const options = await screen.findAllByText(i18n.t("list:transfer.thisList", { title: "Idées cadeaux" }));
  await fireEvent.press(options[options.length - 1]!);
  await waitFor(() => expect(screen.getByLabelText(i18n.t("list:form.type"))).toHaveTextContent("Livres"));
  await fireEvent.press(screen.getByTestId("item-transfer.submit"));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toMatchObject({ targetListId: "w", typeId: "t-books", personId: "p-alex" });
  expect(String(bodies[0]!.id)).toMatch(/^[A-Za-z0-9_-]{16,32}$/);
  expect(bodies[0]).not.toHaveProperty("preview");
});
