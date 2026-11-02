import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

import { getSession, restore, signIn, signOut } from "@/auth/session";
import { NetworkError } from "@/api/client";
import { getSnapshot, putSnapshot } from "@/offline/snapshot";

import { fakeFetch, json, me } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

async function storeToken() {
  await SecureStore.setItemAsync("session.token", "secret-token");
  await SecureStore.setItemAsync("session.expiresAt", "2099-01-01T00:00:00.000Z");
  await SecureStore.setItemAsync("session.userId", "alex");
}

beforeEach(async () => {
  await freshDb();
  for (const key of ["session.token", "session.expiresAt", "session.userId"]) await SecureStore.deleteItemAsync(key);
});

test("restore with a stored token: signed in", async () => {
  await storeToken();
  fakeFetch({ "GET /me": () => json(200, me) });
  await restore();
  expect(getSession()).toEqual({ status: "signedIn", user: me });
});

test("restore without a token: signed out", async () => {
  fakeFetch({});
  await restore();
  expect(getSession()).toEqual({ status: "signedOut", expired: false });
});

test("restore offline keeps the stored session (R3)", async () => {
  await storeToken();
  globalThis.fetch = jest.fn(async () => {
    throw new NetworkError();
  });
  await restore();
  expect(getSession().status).toBe("signedIn");
});

test("GET /me answering 401: token forgotten, signed out (FR-004)", async () => {
  await storeToken();
  fakeFetch({ "GET /me": () => json(401, { error: { code: "unauthorized", message: "Sign in" } }) });
  await restore();
  // L'effacement suit le rappel onUnauthorized.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(getSession()).toEqual({ status: "signedOut", expired: true });
  expect(await SecureStore.getItemAsync("session.token")).toBeNull();
});

test("GET /me with mustChangePassword: only the change screen (FR-005)", async () => {
  await storeToken();
  fakeFetch({ "GET /me": () => json(200, { ...me, mustChangePassword: true }) });
  await restore();
  expect(getSession().status).toBe("mustChangePassword");
});

test("signOut calls /auth/logout then forgets everything, even if the call fails", async () => {
  fakeFetch({});
  await signIn({ token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user: me });
  await putSnapshot("lists", { lists: [] });
  const { calls } = fakeFetch({ "POST /auth/logout": () => json(503, { error: { code: "serverError", message: "down" } }) });
  await signOut();
  expect(calls).toEqual(["POST /auth/logout"]);
  expect(await SecureStore.getItemAsync("session.token")).toBeNull();
  expect(await getSnapshot("lists")).toBeNull();
  expect(getSession()).toEqual({ status: "signedOut", expired: false });
});

test("back to the foreground: the account is read again (address confirmed in the browser, 010)", async () => {
  fakeFetch({});
  await signIn({ token: "secret-token", expiresAt: "2099-01-01T00:00:00.000Z", user: { ...me, emailVerified: false } });
  const { calls } = fakeFetch({ "GET /me": () => json(200, me) });
  // AppState est un mock de jest-expo : on rejoue les écouteurs posés par les modules.
  const listeners = jest.mocked(AppState.addEventListener).mock.calls.map(([, listener]) => listener);
  for (const listener of listeners) listener("active");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(calls).toContain("GET /me");
  expect(getSession()).toEqual({ status: "signedIn", user: me });
});
