import NetInfo, { NetInfoStateType } from "@react-native-community/netinfo";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import NewItem from "../../app/(app)/lists/[listId]/items/new";
import type { Schemas } from "@/api/client";
import { apiTransport, resetStore } from "@/data/store";
import { ListProvider } from "@/features/lists/ListContext";
import { i18n } from "@/i18n";
import { watchNetwork } from "@/network";
import { putSnapshot } from "@/offline/snapshot";
import { setTransport, stopSync } from "@/offline/sync";

import { fakeFetch, json } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

const list: Schemas["MemberList"] = {
  id: "w",
  title: "Nos envies",
  subtitle: null,
  coverImageUrl: null,
  theme: {},
  role: "owner",
  readUrl: "https://ohyoushouldnt.example.test/l/rt",
  inviteUrl: "https://ohyoushouldnt.example.test/i/it",
  hasReadPassword: false,
  categories: [{ id: "t", label: "Jeux", sortOrder: 0 }],
  people: [{ id: "p", label: "Alex" }],
  items: [],
  reservations: [],
  members: [],
};

function routes(extra: Parameters<typeof fakeFetch>[0] = {}) {
  return fakeFetch({
    "GET /lists/w": () => json(200, list),
    "GET /lists": () => json(200, { lists: [] }),
    ...extra,
  });
}

async function renderForm() {
  await render(
    <ListProvider listId="w">
      <NewItem />
    </ListProvider>,
  );
  await screen.findByLabelText("Nom du cadeau");
}

beforeEach(async () => {
  mockParams = {};
  jest.mocked(router.back).mockClear();
  jest.mocked(router.replace).mockClear();
  jest.mocked(router.canGoBack).mockReturnValue(true);
  await freshDb();
  resetStore();
  setTransport(apiTransport);
  await i18n.changeLanguage("fr");
  await putSnapshot("list:w", list);
});

afterEach(() => stopSync());

test("a server error shows under the form and every field keeps its value (FR-014)", async () => {
  routes({
    "GET /capabilities": () => json(200, { apiVersion: "1.1.0", enrich: false, mail: false }),
    "POST /lists/w/items": () => json(400, { error: { code: "typeNotInList", message: "x" } }),
  });
  await renderForm();
  await fireEvent.changeText(screen.getByLabelText("Lien du cadeau"), "https://shop.example.test/puzzle");
  await fireEvent.changeText(screen.getByLabelText("Nom du cadeau"), "Puzzle 1000 pièces");
  await fireEvent.changeText(screen.getByLabelText("Prix (€)"), "24,90");
  await fireEvent.press(screen.getByRole("button", { name: "Ajouter l'idée" }));
  expect(await screen.findByTestId("form-error")).toHaveTextContent(i18n.t("errors:typeNotInList"));
  expect(screen.getByLabelText("Lien du cadeau").props.value).toBe("https://shop.example.test/puzzle");
  expect(screen.getByLabelText("Nom du cadeau").props.value).toBe("Puzzle 1000 pièces");
  expect(screen.getByLabelText("Prix (€)").props.value).toBe("24,90");
});

test("the pre-fill button follows the site: AI label only when the server has one", async () => {
  routes({ "GET /capabilities": () => json(200, { apiVersion: "1.1.0", enrich: true, mail: false }) });
  await renderForm();
  await waitFor(() => expect(screen.getByTestId("enrich")).toHaveTextContent(i18n.t("list:form.fetchInfosAi")));
});

test("opened from a share: pre-filled with the link and the name, then fills itself from the link once", async () => {
  const enrich = jest.fn(() => json(200, { name: "Lampe en noyer massif", price: "59", imageUrl: "", typeId: "", usedLlm: false }));
  routes({
    "GET /capabilities": () => json(200, { apiVersion: "1.2.0", enrich: false, mail: false }),
    "POST /lists/w/enrich": enrich,
  });
  mockParams = { url: "https://shop.example.test/lampe", name: "Lampe de chevet", fill: "1" };
  await renderForm();
  expect(screen.getByLabelText("Lien du cadeau").props.value).toBe("https://shop.example.test/lampe");
  await waitFor(() => expect(screen.getByLabelText("Nom du cadeau").props.value).toBe("Lampe en noyer massif"));
  expect(screen.getByLabelText("Prix (€)").props.value).toBe("59");
  expect(enrich).toHaveBeenCalledTimes(1);
});

test("opened from a share with only text: the name is pre-filled, nothing is fetched", async () => {
  const enrich = jest.fn(() => json(200, {}));
  routes({ "GET /capabilities": () => json(200, { apiVersion: "1.2.0", enrich: false, mail: false }), "POST /lists/w/enrich": enrich });
  mockParams = { url: "", name: "Un puzzle de 1000 pièces", fill: "" };
  await renderForm();
  expect(screen.getByLabelText("Nom du cadeau").props.value).toBe("Un puzzle de 1000 pièces");
  expect(enrich).not.toHaveBeenCalled();
});

function created() {
  const posts: unknown[] = [];
  routes({
    "GET /capabilities": () => json(200, { apiVersion: "1.2.0", enrich: false, mail: false }),
    "POST /lists/w/items": async (request) => {
      posts.push(await request.json());
      return json(201, {});
    },
  });
  return posts;
}

async function addIdea(name: string) {
  await fireEvent.changeText(screen.getByLabelText("Nom du cadeau"), name);
  await fireEvent.press(screen.getByRole("button", { name: "Ajouter l'idée" }));
}

test("saved from the list: back to the screen behind, as before", async () => {
  const posts = created();
  await renderForm();
  await addIdea("Puzzle");
  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(router.replace).not.toHaveBeenCalled();
  expect(posts).toHaveLength(1);
});

test("saved with nothing behind (app opened on the form): the list replaces the form", async () => {
  jest.mocked(router.canGoBack).mockReturnValue(false);
  created();
  await renderForm();
  await addIdea("Puzzle");
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/lists/w"));
  expect(router.back).not.toHaveBeenCalled();
});

test("saved from a share: always the list, even with a screen behind; a second tap creates nothing", async () => {
  const posts = created();
  mockParams = { url: "", name: "Lampe de chevet", fill: "", from: "share" };
  await renderForm();
  await fireEvent.press(screen.getByRole("button", { name: "Ajouter l'idée" }));
  await fireEvent.press(screen.getByRole("button", { name: "Ajouter l'idée" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/lists/w"));
  await fireEvent.press(screen.getByRole("button", { name: "Ajouter l'idée" }));
  expect(router.back).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledTimes(1);
  expect(posts).toHaveLength(1);
});

test("the description is sent with the idea, and pre-fill only fills it when it is empty", async () => {
  const sent: Record<string, unknown>[] = [];
  routes({
    "GET /capabilities": () => json(200, { apiVersion: "1.5.0", enrich: true, mail: false }),
    "POST /lists/w/enrich": () =>
      json(200, { name: "Puzzle", price: "", imageUrl: "", typeId: "", description: "Un puzzle de 1000 pièces.", usedLlm: true }),
    "POST /lists/w/items": async (request) => {
      sent.push((await request.json()) as Record<string, unknown>);
      return json(400, { error: { code: "typeNotInList", message: "x" } });
    },
  });
  await renderForm();
  const description = () => screen.getByLabelText(i18n.t("list:form.description"));
  await fireEvent.changeText(screen.getByLabelText("Lien du cadeau"), "https://shop.example.test/puzzle");
  await fireEvent.press(screen.getByTestId("enrich"));
  await waitFor(() => expect(description().props.value).toBe("Un puzzle de 1000 pièces."));

  await fireEvent.changeText(description(), "Pour les soirées d'hiver.");
  await fireEvent.press(screen.getByTestId("enrich"));
  await waitFor(() => expect(screen.getByLabelText("Nom du cadeau").props.value).toBe("Puzzle"));
  expect(description().props.value).toBe("Pour les soirées d'hiver.");

  await fireEvent.press(screen.getByRole("button", { name: "Ajouter l'idée" }));
  await screen.findByTestId("form-error");
  expect(sent[0]).toMatchObject({ name: "Puzzle", description: "Pour les soirées d'hiver." });
});

test("an older server (before 1.5.0) sends no description: pre-fill leaves the field alone", async () => {
  routes({
    "GET /capabilities": () => json(200, { apiVersion: "1.2.0", enrich: true, mail: false }),
    "POST /lists/w/enrich": () => json(200, { name: "Puzzle", price: "", imageUrl: "", typeId: "", usedLlm: false }),
  });
  await renderForm();
  await fireEvent.changeText(screen.getByLabelText("Lien du cadeau"), "https://shop.example.test/puzzle");
  await fireEvent.press(screen.getByTestId("enrich"));
  await waitFor(() => expect(screen.getByLabelText("Nom du cadeau").props.value).toBe("Puzzle"));
  expect(screen.getByLabelText(i18n.t("list:form.description")).props.value).toBe("");
});

test("the pre-fill button is disabled offline, with the explanation", async () => {
  routes({ "GET /capabilities": () => json(200, { apiVersion: "1.1.0", enrich: false, mail: false }) });
  watchNetwork();
  const listener = jest.mocked(NetInfo.addEventListener).mock.calls[0][0];
  await renderForm();
  await fireEvent.changeText(screen.getByLabelText("Lien du cadeau"), "https://shop.example.test/puzzle");
  expect(screen.getByTestId("enrich")).toBeEnabled();
  listener({ isConnected: false, isInternetReachable: false, type: NetInfoStateType.none, details: null, isWifiEnabled: false });
  await waitFor(() => expect(screen.getByTestId("enrich")).toBeDisabled());
  expect(screen.getByText(i18n.t("mobile:offline.needsNetwork"))).toBeOnTheScreen();
});
