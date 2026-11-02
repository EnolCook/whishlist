import NetInfo, { NetInfoStateType } from "@react-native-community/netinfo";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import Login from "../../app/(auth)/login";
import Register from "../../app/(auth)/register";
import { deleteAccount, getSession, signIn } from "@/auth/session";
import { afterSignIn, clearPendingLink } from "@/links/pending";
import { i18n } from "@/i18n";
import { watchNetwork } from "@/network";

import { fakeFetch, json, me } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

const params: { next?: string } = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => params,
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

beforeEach(async () => {
  await freshDb();
  await i18n.changeLanguage("fr");
});

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText("Adresse e-mail"), email);
  await fireEvent.changeText(screen.getByLabelText("Mot de passe"), password);
  await fireEvent.press(screen.getByRole("button", { name: "Se connecter" }));
}

test("wrong credentials: the errors:invalidCredentials message shows and the e-mail stays", async () => {
  fakeFetch({ "POST /auth/login": () => json(401, { error: { code: "invalidCredentials", message: "x" } }) });
  await render(<Login />);
  await fill("alex@example.test", "wrong-password");
  expect(await screen.findByText("E-mail ou mot de passe incorrect.")).toBeOnTheScreen();
  expect(screen.getByLabelText("Adresse e-mail").props.value).toBe("alex@example.test");
});

test("success: the session is stored", async () => {
  fakeFetch({ "POST /auth/login": () => json(200, { token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user: me }) });
  await render(<Login />);
  await fill("alex@example.test", "demo-password-1");
  await screen.findByRole("button", { name: "Se connecter" });
  expect(getSession()).toEqual({ status: "signedIn", user: me });
});

test("offline: the button is disabled and explains why", async () => {
  watchNetwork();
  const listener = jest.mocked(NetInfo.addEventListener).mock.calls[0][0];
  await render(<Login />);
  await screen.findByLabelText("Adresse e-mail");
  listener({ isConnected: false, isInternetReachable: false, type: NetInfoStateType.none, details: null, isWifiEnabled: false });
  expect(await screen.findByText(i18n.t("mobile:offline.needsNetwork"))).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Se connecter" })).toBeDisabled();
});

test("after deleting the account: the message shows above the form (FR-015)", async () => {
  fakeFetch({});
  await signIn({ token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user: me });
  fakeFetch({ "POST /me/deletion": () => new Response(null, { status: 204 }) });
  await deleteAccount("demo-password-1");
  await render(<Login />);
  expect(await screen.findByText(i18n.t("auth:account.deleted"))).toBeOnTheScreen();
});

test.each([
  ["login", Login],
  ["register", Register],
])("%s: the legal links open the two pages (FR-002)", async (_name, Screen) => {
  await render(<Screen />);
  await fireEvent.press(await screen.findByRole("link", { name: "Mentions légales" }));
  await fireEvent.press(screen.getByRole("link", { name: "Données personnelles" }));
  expect(jest.mocked(router.push).mock.calls.slice(-2)).toEqual([["/legal/mentions"], ["/legal/privacy"]]);
});

test("connexion ouverte par /connexion?next=/inviter/… (011) : l'invitation est gardée pour après", async () => {
  params.next = "/inviter/tok";
  try {
    await render(<Login />);
    expect(afterSignIn()).toBe("/links/invite/tok");
    clearPendingLink();
    params.next = "/compte";
    await render(<Register />);
    expect(afterSignIn()).toBe("/");
  } finally {
    delete params.next;
    clearPendingLink();
  }
});
