import { render, screen } from "@testing-library/react-native";

import MyLists from "../../app/(app)/index";
import { signIn } from "@/auth/session";
import { resetStore } from "@/data/store";
import { i18n } from "@/i18n";

import { fakeFetch, json, me } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

async function signedInAs(user: typeof me) {
  await freshDb();
  resetStore();
  await i18n.changeLanguage("fr");
  fakeFetch({});
  await signIn({ token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user });
  fakeFetch({ "GET /lists": () => json(200, { lists: [] }) });
}

test("address not confirmed: the reminder shows and « Créer une liste » is disabled (010, FR-005)", async () => {
  await signedInAs({ ...me, emailVerified: false });
  await render(<MyLists />);
  expect(await screen.findByTestId("verify.banner")).toBeOnTheScreen();
  expect(screen.getByText(/Confirmez votre adresse e-mail pour créer une liste/)).toBeOnTheScreen();
  expect(screen.getByTestId("lists.new")).toBeDisabled();
  expect(screen.getByTestId("lists.new-locked")).toHaveTextContent(/Confirmez d'abord votre adresse e-mail/);
});

test("address confirmed: no reminder, « Créer une liste » works", async () => {
  await signedInAs(me);
  await render(<MyLists />);
  expect(await screen.findByTestId("lists.new")).toBeEnabled();
  expect(screen.queryByTestId("verify.banner")).toBeNull();
  expect(screen.queryByTestId("lists.new-locked")).toBeNull();
});
