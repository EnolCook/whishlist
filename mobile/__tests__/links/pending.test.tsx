import { render, screen } from "@testing-library/react-native";

import AuthLayout from "../../app/(auth)/_layout";
import ChangePassword from "../../app/change-password";
import { signIn, signOut } from "@/auth/session";
import { afterSignIn, clearPendingLink, setPendingLink } from "@/links/pending";

import { me } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text: RNText } = jest.requireActual("react-native");
    return <RNText>{`redirect:${href}`}</RNText>;
  },
  Stack: () => null,
}));

beforeEach(freshDb);
afterEach(async () => {
  clearPendingLink();
  await signOut();
});

test("sans lien : l'accueil ; avec un lien : le dernier ouvert, jusqu'à ce que son écran l'efface", () => {
  expect(afterSignIn()).toBe("/");
  setPendingLink("/links/invite/a");
  setPendingLink("/links/invite/b");
  expect(afterSignIn()).toBe("/links/invite/b");
  expect(afterSignIn()).toBe("/links/invite/b");
  clearPendingLink();
  expect(afterSignIn()).toBe("/");
});

test("une fois connectée, la personne revient au lien qui l'a amenée à la connexion", async () => {
  setPendingLink("/links/invite/tok");
  await signIn({ token: "t", expiresAt: "2099-01-01T00:00:00.000Z", user: me });
  await render(<AuthLayout />);
  expect(screen.getByText("redirect:/links/invite/tok")).toBeOnTheScreen();
});

test("changement de mot de passe imposé : il passe d'abord, puis l'app reprend le lien (R5)", async () => {
  setPendingLink("/links/invite/tok");
  await signIn({ token: "t", expiresAt: "2099-01-01T00:00:00.000Z", user: { ...me, mustChangePassword: true } });
  await render(<AuthLayout />);
  expect(screen.getByText("redirect:/change-password")).toBeOnTheScreen();
  await signIn({ token: "t", expiresAt: "2099-01-01T00:00:00.000Z", user: me });
  await render(<ChangePassword />);
  expect(screen.getByText("redirect:/links/invite/tok")).toBeOnTheScreen();
});
