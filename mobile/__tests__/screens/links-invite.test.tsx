import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import InviteLink from "../../app/links/invite/[token]";
import { signIn, signOut } from "@/auth/session";
import { resetStore } from "@/data/store";
import { i18n } from "@/i18n";
import { afterSignIn, clearPendingLink } from "@/links/pending";

import { fakeFetch, json, me } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ token: "it" }),
  Redirect: () => null,
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

const lists = () => json(200, { lists: [] });
const memberList = () => json(404, { error: { code: "listMissing", message: "x" } });

beforeEach(async () => {
  await freshDb();
  resetStore();
  await signOut();
  clearPendingLink();
  await i18n.changeLanguage("fr");
  jest.mocked(router.replace).mockClear();
  jest.mocked(router.push).mockClear();
});

async function signInAs(user = me) {
  await signIn({ token: "t", expiresAt: "2099-01-01T00:00:00.000Z", user });
}

test("sans session : le lien est gardé et la connexion ou l'inscription est proposée", async () => {
  fakeFetch({});
  await render(<InviteLink />);
  expect(screen.getByTestId("invite.register")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("invite.login"));
  expect(router.push).toHaveBeenCalledWith("/login");
  expect(afterSignIn()).toBe("/links/invite/it");
});

test("connectée, pas encore membre : le titre, « Rejoindre », puis la liste", async () => {
  await signInAs();
  const { calls } = fakeFetch({
    "GET /invitations/it": () => json(200, { title: "Liste d'Alex", listId: null }),
    "POST /invitations/it/accept": () => json(200, { id: "w" }),
    "GET /lists": lists,
    "GET /lists/w": memberList,
  });
  await render(<InviteLink />);
  expect(await screen.findByText("Rejoindre « Liste d'Alex »")).toBeOnTheScreen();
  expect(afterSignIn()).toBe("/");
  await fireEvent.press(screen.getByTestId("invite.join"));
  expect(calls).toContain("POST /invitations/it/accept");
  expect(router.replace).toHaveBeenCalledWith("/lists/w");
});

test("déjà membre : la liste s'ouvre tout de suite, sans « Rejoindre »", async () => {
  await signInAs();
  const { calls } = fakeFetch({
    "GET /invitations/it": () => json(200, { title: "Liste d'Alex", listId: "w" }),
    "GET /lists": lists,
    "GET /lists/w": memberList,
  });
  await render(<InviteLink />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/lists/w"));
  expect(calls).not.toContain("POST /invitations/it/accept");
});

test("adresse pas confirmée : le refus du serveur et le rappel de confirmation", async () => {
  await signInAs({ ...me, emailVerified: false });
  fakeFetch({
    "GET /invitations/it": () => json(200, { title: "Liste d'Alex", listId: null }),
    "POST /invitations/it/accept": () => json(403, { error: { code: "emailNotVerified", message: "x" } }),
  });
  await render(<InviteLink />);
  await fireEvent.press(await screen.findByTestId("invite.join"));
  expect(await screen.findByTestId("invite.join-error")).toBeOnTheScreen();
  expect(screen.getByTestId("verify.banner")).toBeOnTheScreen();
  expect(router.replace).not.toHaveBeenCalled();
});

test("lien régénéré : le message du site", async () => {
  await signInAs();
  fakeFetch({ "GET /invitations/it": () => json(404, { error: { code: "inviteLinkBroken", message: "x" } }) });
  await render(<InviteLink />);
  expect(await screen.findByTestId("invite.error")).toBeOnTheScreen();
  expect(screen.getByTestId("invite.home")).toBeOnTheScreen();
});

test("mot de passe à changer d'abord : le lien est gardé pour après (R5)", async () => {
  await signInAs({ ...me, mustChangePassword: true });
  const { calls } = fakeFetch({});
  await render(<InviteLink />);
  await waitFor(() => expect(afterSignIn()).toBe("/links/invite/it"));
  expect(calls).toEqual([]);
});
