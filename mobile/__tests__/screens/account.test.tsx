import NetInfo, { NetInfoStateType } from "@react-native-community/netinfo";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Linking } from "react-native";

import Account from "../../app/(app)/account";
import { signIn } from "@/auth/session";
import { resetStore } from "@/data/store";
import { i18n } from "@/i18n";
import { watchNetwork } from "@/network";
import { tokens } from "@/theme/tokens";

import { fakeFetch, json, me } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0", extra: { apiUrl: "https://api.example.test" } } },
}));

beforeEach(async () => {
  await freshDb();
  resetStore();
  await i18n.changeLanguage("fr");
  fakeFetch({});
  await signIn({ token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user: me });
});

type Node = { props: Record<string, unknown>; children: (Node | string)[] | null };

/** Libellés des boutons et liens, dans l'ordre de l'écran. */
function actions(): string[] {
  const labels: string[] = [];
  const walk = (node: Node | string) => {
    if (typeof node === "string") return;
    const role = node.props.accessibilityRole;
    if (role === "button" || role === "link") labels.push(String(node.props.accessibilityLabel));
    for (const child of node.children ?? []) walk(child);
  };
  walk(screen.toJSON() as unknown as Node);
  return labels;
}

test("the bottom section, in the order of FR-001, ends with the destructive deletion", async () => {
  await render(<Account />);
  await fireEvent.press(await screen.findByTestId("account.data-toggle"));
  const labels = actions();
  const expected = [
    "Mentions légales",
    "Données personnelles",
    "Télécharger mes données",
    "Licences",
    "Nous écrire",
    "Se déconnecter",
    "Supprimer mon compte",
  ];
  expect(labels.slice(-expected.length)).toEqual(expected);
  expect(screen.getByText("Version 1.0.0")).toBeOnTheScreen();
  expect(screen.getByTestId("delete-account-box")).toHaveStyle({ backgroundColor: tokens.colors.destructive });
});

test("the links open the legal screens, the deletion screen and the e-mail app", async () => {
  const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  await render(<Account />);
  await fireEvent.press(await screen.findByTestId("account.data-toggle"));
  await fireEvent.press(screen.getByRole("link", { name: "Mentions légales" }));
  await fireEvent.press(screen.getByRole("link", { name: "Données personnelles" }));
  await fireEvent.press(screen.getByRole("link", { name: "Licences" }));
  await fireEvent.press(screen.getByRole("button", { name: "Supprimer mon compte" }));
  expect(jest.mocked(router.push).mock.calls.map(([path]) => path)).toEqual([
    "/legal/mentions",
    "/legal/privacy",
    "/legal/licenses",
    "/delete-account",
  ]);
  await fireEvent.press(screen.getByRole("link", { name: "Nous écrire" }));
  expect(openURL).toHaveBeenCalledWith("mailto:contact@ohyoushouldnt.app");
});

test("the data card opens collapsed: its links are hidden until it is unfolded", async () => {
  await render(<Account />);
  const toggle = await screen.findByTestId("account.data-toggle");
  expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
  expect(screen.getByText("Vos données et informations")).toBeOnTheScreen();
  expect(screen.queryByRole("link", { name: "Mentions légales" })).toBeNull();
  await fireEvent.press(toggle);
  expect(screen.getByRole("link", { name: "Mentions légales" })).toBeOnTheScreen();
});

test("the profile card opens collapsed, then shows the saved name in the open card", async () => {
  fakeFetch({ "PATCH /me": () => json(200, { ...me, displayName: "Alexandra" }) });
  await render(<Account />);
  const toggle = await screen.findByTestId("account.profile-toggle");
  expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
  expect(screen.queryByTestId("account.name")).toBeNull();
  expect(screen.getByTestId("account.name", { includeHiddenElements: true })).toBeTruthy();

  await fireEvent.press(toggle);
  await fireEvent.changeText(screen.getByTestId("account.name"), "Alexandra");
  await fireEvent.press(screen.getByTestId("account.save-name"));
  expect(await screen.findByText("Nom enregistré.")).toBeOnTheScreen();
  expect(screen.getByTestId("account.profile-toggle").props.accessibilityState).toMatchObject({ expanded: true });
});

test("the password card opens collapsed, shows the error then the success in the open card", async () => {
  let attempts = 0;
  fakeFetch({
    "POST /me/password": () =>
      ++attempts === 1
        ? json(400, { error: { code: "wrongCurrentPassword", message: "wrong" } })
        : json(200, { token: "new-token", expiresAt: "2099-01-01T00:00:00.000Z", user: me }),
  });
  await render(<Account />);
  const toggle = await screen.findByTestId("account.password-toggle");
  expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
  expect(screen.queryByTestId("account.password-current")).toBeNull();

  // Les deux cartes peuvent être ouvertes ensemble.
  await fireEvent.press(screen.getByTestId("account.profile-toggle"));
  await fireEvent.press(toggle);
  expect(screen.getByTestId("account.name")).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByTestId("account.password-current"), "mauvais-mot-de-passe");
  await fireEvent.changeText(screen.getByTestId("account.password-next"), "nouveau-mot-de-passe");
  await fireEvent.changeText(screen.getByTestId("account.password-confirm"), "nouveau-mot-de-passe");
  await fireEvent.press(screen.getByTestId("account.password-submit"));
  expect(await screen.findByText("Mot de passe actuel incorrect.")).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByTestId("account.password-current"), "bon-mot-de-passe");
  await fireEvent.press(screen.getByTestId("account.password-submit"));
  expect(await screen.findByText(i18n.t("auth:changePassword.success"))).toBeOnTheScreen();
  expect(screen.getByTestId("account.password-toggle").props.accessibilityState).toMatchObject({ expanded: true });
});

test("address not confirmed: the reminder shows at the top of « Mon compte » (010)", async () => {
  fakeFetch({});
  await signIn({ token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user: { ...me, emailVerified: false } });
  await render(<Account />);
  expect(await screen.findByTestId("verify.banner")).toBeOnTheScreen();
});

test("address confirmed: no reminder on « Mon compte »", async () => {
  await render(<Account />);
  expect(await screen.findByTestId("account.screen")).toBeOnTheScreen();
  expect(screen.queryByTestId("verify.banner")).toBeNull();
});

test("« Renvoyer le lien » asks the server for a new link and says so (010, US2)", async () => {
  fakeFetch({});
  await signIn({ token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user: { ...me, emailVerified: false } });
  const { calls } = fakeFetch({ "POST /me/email-verification": () => json(202, { sent: true }) });
  await render(<Account />);
  await fireEvent.press(await screen.findByTestId("verify.resend"));
  expect(await screen.findByTestId("verify.sent")).toBeOnTheScreen();
  expect(screen.getByText(/Un nouveau lien vient de partir/)).toBeOnTheScreen();
  expect(calls).toContain("POST /me/email-verification");
});

test("« Renvoyer le lien » shows the server's refusal", async () => {
  fakeFetch({});
  await signIn({ token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user: { ...me, emailVerified: false } });
  fakeFetch({
    "POST /me/email-verification": () =>
      json(409, { error: { code: "emailAlreadyVerified", message: "Votre adresse e-mail est déjà confirmée." } }),
  });
  await render(<Account />);
  await fireEvent.press(await screen.findByTestId("verify.resend"));
  expect(await screen.findByText("Votre adresse e-mail est déjà confirmée.")).toBeOnTheScreen();
});

test("« Adresse de connexion »: a pending change shows the new address and can be cancelled (010, US3)", async () => {
  const { calls } = fakeFetch({
    "POST /me/email": () => json(200, { ...me, pendingEmail: "alex.b@example.test" }),
    "DELETE /me/email": () => json(200, me),
  });
  await render(<Account />);
  await fireEvent.press(await screen.findByTestId("account.email-toggle"));
  expect(screen.getByText("Adresse actuelle : alex@example.test")).toBeOnTheScreen();
  expect(screen.getByTestId("account.email-submit")).toBeDisabled();
  await fireEvent.changeText(screen.getByTestId("account.email-new"), " alex.b@example.test ");
  await fireEvent.changeText(screen.getByTestId("account.email-password"), "secret-ok!!");
  await fireEvent.press(screen.getByTestId("account.email-submit"));
  expect(await screen.findByTestId("account.email-pending")).toHaveTextContent(/alex\.b@example\.test/);
  expect(screen.getByTestId("account.email-saved")).toHaveTextContent(/Un lien de confirmation est parti/);

  await fireEvent.press(screen.getByTestId("account.email-cancel"));
  expect(await screen.findByText("Le changement d'adresse est annulé.")).toBeOnTheScreen();
  expect(screen.queryByTestId("account.email-pending")).toBeNull();
  expect(calls).toEqual(expect.arrayContaining(["POST /me/email", "DELETE /me/email"]));
});

test("« Adresse de connexion »: a server without email applies the address at once", async () => {
  fakeFetch({ "POST /me/email": () => json(200, { ...me, email: "alex.b@example.test" }) });
  await render(<Account />);
  await fireEvent.press(await screen.findByTestId("account.email-toggle"));
  await fireEvent.changeText(screen.getByTestId("account.email-new"), "alex.b@example.test");
  await fireEvent.changeText(screen.getByTestId("account.email-password"), "secret-ok!!");
  await fireEvent.press(screen.getByTestId("account.email-submit"));
  expect(await screen.findByText("Votre adresse de connexion est maintenant alex.b@example.test.")).toBeOnTheScreen();
  expect(screen.getByText("Adresse actuelle : alex.b@example.test")).toBeOnTheScreen();
});

test("« Adresse de connexion »: the server's refusals show in the card", async () => {
  let attempts = 0;
  fakeFetch({
    "POST /me/email": () =>
      ++attempts === 1
        ? json(400, { error: { code: "wrongCurrentPassword", message: "wrong" } })
        : json(400, { error: { code: "emailTaken", message: "taken" } }),
  });
  await render(<Account />);
  await fireEvent.press(await screen.findByTestId("account.email-toggle"));
  await fireEvent.changeText(screen.getByTestId("account.email-new"), "camille@example.test");
  await fireEvent.changeText(screen.getByTestId("account.email-password"), "faux");
  await fireEvent.press(screen.getByTestId("account.email-submit"));
  expect(await screen.findByText("Mot de passe actuel incorrect.")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("account.email-submit"));
  expect(await screen.findByText("Cet e-mail est déjà utilisé.")).toBeOnTheScreen();
});

// Dernier : le réseau reste coupé pour la suite du fichier.
test("offline: download and deletion are disabled, the legal pages stay open", async () => {
  watchNetwork();
  const listener = jest.mocked(NetInfo.addEventListener).mock.calls[0][0];
  await render(<Account />);
  await screen.findByText("Vos données et informations");
  listener({ isConnected: false, isInternetReachable: false, type: NetInfoStateType.none, details: null, isWifiEnabled: false });
  expect(await screen.findByRole("button", { name: "Supprimer mon compte" })).toBeDisabled();
  // La carte des données se déplie hors ligne (009, US3 scénario 4).
  await fireEvent.press(screen.getByTestId("account.data-toggle"));
  expect(screen.getByRole("link", { name: "Télécharger mes données" })).toBeDisabled();
  expect(screen.getByRole("link", { name: "Mentions légales" })).toBeEnabled();
  // Les cartes se déplient hors ligne ; l'enregistrement du nom reste désactivé.
  await fireEvent.press(screen.getByTestId("account.profile-toggle"));
  expect(screen.getByTestId("account.profile-toggle").props.accessibilityState).toMatchObject({ expanded: true });
  expect(screen.getByTestId("account.save-name")).toBeDisabled();
});
