import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import ResetPasswordLink from "../../app/links/reset-password/[token]";
import { getSession, signIn, signOut } from "@/auth/session";
import { i18n } from "@/i18n";

import { fakeFetch, json, me } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ token: "tok" }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

beforeEach(async () => {
  await freshDb();
  await signOut();
  await i18n.changeLanguage("fr");
  jest.mocked(router.replace).mockClear();
});

async function submit(password: string) {
  await fireEvent.changeText(screen.getByTestId("reset-password.password"), password);
  await fireEvent.press(screen.getByTestId("reset-password.submit"));
}

test("sans session : le nouveau mot de passe connecte et ouvre les listes", async () => {
  let body: Record<string, unknown> = {};
  fakeFetch({
    "POST /auth/password-reset/confirm": async (request) => {
      body = await request.json();
      return json(200, { session: { token: "new-token", expiresAt: "2099-01-01T00:00:00.000Z", user: me } });
    },
  });
  await render(<ResetPasswordLink />);
  await submit("nouveau-mdp-solide");
  await screen.findByTestId("reset-password.screen");
  expect(body).toEqual({ token: "tok", password: "nouveau-mdp-solide", signIn: true });
  expect(getSession().status).toBe("signedIn");
  expect(router.replace).toHaveBeenCalledWith("/");
});

test("connectée à un autre compte : pas de session demandée, la session de l'app reste", async () => {
  await signIn({ token: "mine", expiresAt: "2099-01-01T00:00:00.000Z", user: { ...me, id: "sam" } });
  let body: Record<string, unknown> = {};
  fakeFetch({
    "POST /auth/password-reset/confirm": async (request) => {
      body = await request.json();
      return json(200, { session: null });
    },
  });
  await render(<ResetPasswordLink />);
  await submit("nouveau-mdp-solide");
  expect(await screen.findByTestId("reset-password.done")).toBeOnTheScreen();
  expect(body.signIn).toBe(false);
  const session = getSession();
  expect(session.status === "signedIn" && session.user?.id).toBe("sam");
});

test("mot de passe trop court : le message du serveur, le formulaire reste", async () => {
  fakeFetch({
    "POST /auth/password-reset/confirm": () => json(400, { error: { code: "passwordTooShort", message: "x" } }),
  });
  await render(<ResetPasswordLink />);
  await submit("court");
  expect(await screen.findByTestId("reset-password.error")).toBeOnTheScreen();
  expect(screen.queryByTestId("reset-password.new-link")).toBeNull();
});

test("lien plus valide : le message, et « Demander un nouveau lien »", async () => {
  fakeFetch({
    "POST /auth/password-reset/confirm": () => json(400, { error: { code: "resetLinkExpired", message: "x" } }),
  });
  await render(<ResetPasswordLink />);
  await submit("nouveau-mdp-solide");
  await fireEvent.press(await screen.findByTestId("reset-password.new-link"));
  expect(router.replace).toHaveBeenCalledWith("/forgot-password");
});
