import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { redirectSystemPath } from "../../app/+native-intent";
import Share from "../../app/(app)/share";
import type { Schemas } from "@/api/client";
import { apiTransport, resetStore } from "@/data/store";
import { sharedIdea } from "@/features/incoming/sharedIdea";
import { afterSignIn, clearPendingLink, setPendingLink } from "@/links/pending";
import { i18n } from "@/i18n";
import { setTransport, stopSync } from "@/offline/sync";

import { fakeFetch, json } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";
import { setSharedPayloads } from "../helpers/sharing";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

describe("sharedIdea", () => {
  test("a URL share: the link, no name", () => {
    expect(sharedIdea([{ shareType: "url", value: "https://shop.example.test/lampe", mimeType: "text/plain" }])).toEqual({
      url: "https://shop.example.test/lampe",
      name: "",
    });
  });

  test("a text with a link: the link, and the text around it as the name, without separators", () => {
    expect(sharedIdea([{ shareType: "text", value: "Lampe de chevet en noyer – https://shop.example.test/p/42?ref=app", mimeType: "text/plain" }])).toEqual({
      url: "https://shop.example.test/p/42?ref=app",
      name: "Lampe de chevet en noyer",
    });
    expect(sharedIdea([{ shareType: "text", value: "Regarde ça : https://shop.example.test/a).", mimeType: "text/plain" }])?.url).toBe(
      "https://shop.example.test/a",
    );
  });

  test("only text: no link, the text as the name; an image alone or nothing: null", () => {
    expect(sharedIdea([{ shareType: "text", value: "  Un puzzle de 1000 pièces  ", mimeType: "text/plain" }])).toEqual({ url: "", name: "Un puzzle de 1000 pièces" });
    expect(sharedIdea([{ shareType: "image", value: "file:///tmp/a.jpg", mimeType: "image/jpeg" }])).toBeNull();
    expect(sharedIdea([])).toBeNull();
  });
});

test("+native-intent: a share opens « Ajouter à une liste » and is kept as the pending link (login comes back to it)", () => {
  clearPendingLink();
  expect(redirectSystemPath({ path: "ohyoushouldnt://expo-sharing", initial: false })).toBe("/share");
  expect(afterSignIn()).toBe("/share");
  clearPendingLink();
  // Les autres adresses gardent la règle des liens du site.
  expect(redirectSystemPath({ path: "ohyoushouldnt://inviter/tok", initial: false })).toBe("/links/invite/tok");
  expect(afterSignIn()).toBe("/");
});

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
  items: [],
  categories: [{ id: "t", label: "Divers", sortOrder: 0 }],
  people: [{ id: "p", label: "Alex" }],
};
const summary = (id: string, title: string): Schemas["ListSummary"] => ({
  id,
  title,
  subtitle: null,
  coverImageUrl: null,
  theme: {},
  role: "owner",
  itemCount: 0,
  readUrl: base.readUrl,
});
const lampShare = [{ shareType: "text" as const, value: "Lampe de chevet https://shop.example.test/lampe", mimeType: "text/plain" }];

beforeEach(async () => {
  await freshDb();
  resetStore();
  setTransport(apiTransport);
  await i18n.changeLanguage("fr");
  jest.mocked(router.replace).mockClear();
  mockParams = {};
});

afterEach(() => {
  stopSync();
  setSharedPayloads([]);
});

describe("Ajouter à une liste", () => {
  test("several lists: pick one, the share is cleared and the form opens with the link, the name and auto-fill", async () => {
    fakeFetch({ "GET /lists": () => json(200, { lists: [summary("w", "Idées cadeaux"), summary("w2", "Noël")] }) });
    setSharedPayloads(lampShare);
    setPendingLink("/share");
    await render(<Share />);
    // Arrivé sur l'écran (après la connexion s'il le fallait) : le lien en attente est servi.
    expect(afterSignIn()).toBe("/");
    expect(await screen.findByTestId("incoming.url")).toHaveTextContent("https://shop.example.test/lampe");
    expect(screen.getByText(i18n.t("mobile:incoming.title"))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("incoming.list-w2"));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/lists/[listId]/items/new",
      params: { listId: "w2", url: "https://shop.example.test/lampe", name: "Lampe de chevet", fill: "1" },
    });
    await waitFor(() => expect(screen.queryByTestId("incoming.url")).toBeNull());
  });

  test("one list: straight to the form", async () => {
    fakeFetch({ "GET /lists": () => json(200, { lists: [summary("w", "Idées cadeaux")] }) });
    setSharedPayloads(lampShare);
    await render(<Share />);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ listId: "w", fill: "1" }) })),
    );
  });

  test("nothing usable, or no list yet: a clear message", async () => {
    fakeFetch({ "GET /lists": () => json(200, { lists: [] }) });
    setSharedPayloads([{ shareType: "image", value: "file:///tmp/a.jpg", mimeType: "image/jpeg" }]);
    const view = await render(<Share />);
    expect(await screen.findByTestId("incoming.nothing")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("incoming.cancel"));
    expect(router.replace).toHaveBeenCalledWith("/");
    view.unmount();
    setSharedPayloads(lampShare);
    await render(<Share />);
    expect(await screen.findByTestId("incoming.no-list")).toBeOnTheScreen();
  });
});
