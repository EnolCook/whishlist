import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Linking, Share } from "react-native";

import ShareTab from "../../app/(app)/lists/[listId]/share";
import type { Schemas } from "@/api/client";
import { resetStore } from "@/data/store";
import { ListProvider } from "@/features/lists/ListContext";
import { i18n } from "@/i18n";
import { enqueue } from "@/offline/outbox";
import { putSnapshot } from "@/offline/snapshot";

import { fakeFetch, json } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
// Le QR code est remplacé par une vue qui expose la valeur encodée.
jest.mock("react-native-qrcode-svg", () => {
  const { Text } = require("react-native");
  return ({ value }: { value: string }) => <Text testID="qr-value">{value}</Text>;
});

const READ_URL = "https://ohyoushouldnt.example.test/l/rt";
const INVITE_URL = "https://ohyoushouldnt.example.test/i/it";

const list: Schemas["MemberList"] = {
  id: "w",
  title: "Nos envies",
  subtitle: null,
  coverImageUrl: null,
  theme: {},
  role: "owner",
  readUrl: READ_URL,
  inviteUrl: INVITE_URL,
  hasReadPassword: false,
  categories: [{ id: "t", label: "Jeux", sortOrder: 0 }],
  people: [{ id: "p", label: "Alex" }],
  items: [],
  reservations: [],
  members: [],
};

async function renderShare(listId = "w", body: Schemas["MemberList"] | null = list) {
  fakeFetch(body ? { [`GET /lists/${listId}`]: () => json(200, body) } : {});
  await render(
    <ListProvider listId={listId}>
      <ShareTab />
    </ListProvider>,
  );
}

beforeEach(async () => {
  await freshDb();
  resetStore();
  await i18n.changeLanguage("fr");
  await putSnapshot("list:w", list);
});

test("the QR code encodes exactly readUrl, never inviteUrl (FR-023)", async () => {
  await renderShare();
  expect(await screen.findByTestId("qr-value")).toHaveTextContent(READ_URL);
  expect(screen.queryByText(INVITE_URL)).toBeNull();
});

test("Share opens the share sheet with the title and readUrl (FR-021)", async () => {
  const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction", activityType: undefined });
  await renderShare();
  await fireEvent.press(await screen.findByRole("button", { name: "Partager" }));
  expect(share).toHaveBeenCalledWith({ title: "Nos envies", message: `Nos envies — ${READ_URL}` });
});

test("Copy puts readUrl in the clipboard, then confirms (FR-022)", async () => {
  await renderShare();
  await fireEvent.press(await screen.findByTestId("copy-link"));
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(READ_URL);
  expect(await screen.findByText("Lien copié.")).toBeOnTheScreen();
});

test("a list with a read password says so, without the password (FR-024)", async () => {
  await putSnapshot("list:w", { ...list, hasReadPassword: true });
  await renderShare("w", { ...list, hasReadPassword: true });
  expect(await screen.findByTestId("password-notice")).toHaveTextContent(i18n.t("mobile:share.passwordNotice"));
});

test("a list not sent yet shows neither QR code nor sharing, but the explanation", async () => {
  await enqueue({
    kind: "createList",
    listId: "new-list-id-00001",
    targetId: "new-list-id-00001",
    payload: { id: "new-list-id-00001", title: "Anniversaire", category: "Jeux", person: "Lou", categoryId: "c-new-list-00001", personId: "p-new-list-00001" },
  });
  await renderShare("new-list-id-00001", null);
  expect(await screen.findByText(i18n.t("mobile:share.pendingList"))).toBeOnTheScreen();
  expect(screen.queryByTestId("qr-value")).toBeNull();
  expect(screen.queryByRole("button", { name: "Partager" })).toBeNull();
});

test("« Voir comme un invité » ouvre la vue invité de l'app, sans renvoyer le membre à sa liste (011)", async () => {
  await putSnapshot("list:w", { ...list, readUrl: "https://api.example.test/en/l/rt" });
  await renderShare("w", { ...list, readUrl: "https://api.example.test/en/l/rt" });
  await fireEvent.press(await screen.findByText(i18n.t("list:viewAsGuest")));
  expect(router.push).toHaveBeenCalledWith("/guest/rt?preview=1");
});

test("« Voir comme un invité » vers un autre serveur que celui de l'app : le navigateur", async () => {
  const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  await renderShare();
  await fireEvent.press(await screen.findByText(i18n.t("list:viewAsGuest")));
  expect(openURL).toHaveBeenCalledWith(READ_URL);
  openURL.mockRestore();
});
