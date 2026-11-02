import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import GuestList from "../../app/guest/[readToken]/index";
import { signIn, signOut } from "@/auth/session";
import { claimsFor, clearGuestAccess, saveClaim, saveUnlock, unlockTokenFor } from "@/features/guest/storage";
import { i18n } from "@/i18n";
import { putSnapshot } from "@/offline/snapshot";

import { fakeFetch, json, me } from "../helpers/fetch";
import { publicItem as item, publicList } from "../helpers/public-list";
import { freshDb } from "../helpers/memory-db";

const params: { readToken: string; typeId?: string; preview?: string } = { readToken: "rt" };
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => params,
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

beforeEach(async () => {
  await freshDb();
  await signOut();
  await clearGuestAccess();
  await i18n.changeLanguage("fr");
  params.readToken = "rt";
  delete params.typeId;
  delete params.preview;
  jest.mocked(router.replace).mockClear();
  jest.mocked(router.push).mockClear();
});

test("sans compte : la liste, ses catégories, et « Réserver ce cadeau » mène au formulaire", async () => {
  const { calls } = fakeFetch({ "GET /public/lists/rt": () => json(200, publicList()) });
  await render(<GuestList />);
  expect(await screen.findByTestId("guest.title")).toHaveTextContent("Liste d'Alex");
  expect(screen.getByText("Idée i1")).toBeOnTheScreen();
  expect(screen.queryByText(/Modifier|Archiver/)).toBeNull();
  await fireEvent.press(screen.getByTestId("guest.offer-0"));
  expect(router.push).toHaveBeenCalledWith("/guest/rt/reserve?itemId=i1");
  expect(calls).toEqual(["GET /public/lists/rt"]);
});

test("filtre par catégorie, aussi depuis le lien /l/<t>/types?typeId=", async () => {
  params.typeId = "t2";
  fakeFetch({ "GET /public/lists/rt": () => json(200, publicList()) });
  await render(<GuestList />);
  await screen.findByTestId("guest.title");
  expect(screen.queryByText("Idée i1")).toBeNull();
  expect(screen.getByText("Idée i2")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Toutes les idées"));
  expect(screen.getByText("Idée i1")).toBeOnTheScreen();
});

test("membre de la liste : sa vue membre, sans lire la liste publique, sauf depuis « Voir comme un invité »", async () => {
  await signIn({ token: "t", expiresAt: "2099-01-01T00:00:00.000Z", user: me });
  await putSnapshot("lists", [{ id: "w", readUrl: "https://api.example.test/l/rt" }]);
  const { calls } = fakeFetch({ "GET /public/lists/rt": () => json(200, publicList()) });
  await render(<GuestList />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/lists/w"));
  expect(calls).toEqual([]);

  jest.mocked(router.replace).mockClear();
  params.preview = "1";
  await render(<GuestList />);
  await screen.findByTestId("guest.title");
  expect(router.replace).not.toHaveBeenCalled();
});

test("liste protégée : mot de passe faux refusé, le bon déverrouille et reste gardé", async () => {
  let unlocked = false;
  fakeFetch({
    "GET /public/lists/rt": (request) =>
      unlocked && request.headers.get("X-Read-Unlock") === "unlock-1"
        ? json(200, publicList())
        : json(423, { error: { code: "readPasswordRequired", message: "x" }, title: "Liste d'Alex" }),
    "POST /public/lists/rt/unlock": async (request) => {
      const { password } = await request.json();
      if (password !== "bon-mot-de-passe") return json(400, { error: { code: "badPassword", message: "x" } });
      unlocked = true;
      return json(200, { unlockToken: "unlock-1", expiresAt: "2099-01-01T00:00:00.000Z" });
    },
  });
  await render(<GuestList />);
  await fireEvent.changeText(await screen.findByTestId("guest.password"), "faux");
  await fireEvent.press(screen.getByTestId("guest.unlock"));
  expect(await screen.findByText("Le mot de passe est incorrect.")).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByTestId("guest.password"), "bon-mot-de-passe");
  await fireEvent.press(screen.getByTestId("guest.unlock"));
  expect(await screen.findByTestId("guest.title")).toBeOnTheScreen();
  expect(await unlockTokenFor("rt")).toBe("unlock-1");
});

test("lien inconnu : « liste introuvable » ; serveur injoignable : « Réessayer »", async () => {
  fakeFetch({ "GET /public/lists/rt": () => json(404, { error: { code: "listMissing", message: "x" } }) });
  await render(<GuestList />);
  expect(await screen.findByTestId("guest.missing")).toBeOnTheScreen();

  let attempts = 0;
  fakeFetch({
    "GET /public/lists/rt": () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("Network request failed");
      return json(200, publicList());
    },
  });
  await render(<GuestList />);
  await fireEvent.press(await screen.findByTestId("guest.retry"));
  expect(await screen.findByTestId("guest.title")).toBeOnTheScreen();
});

test("sa propre réservation : annulée avec son claim, puis l'idée redevient réservable", async () => {
  await saveClaim("rt", "r1", "claim-1");
  let reserved = true;
  let claimsHeader: string | null = null;
  fakeFetch({
    "GET /public/lists/rt": () =>
      json(200, publicList([item("i1", "t1", reserved ? { mine: true, reservationId: "r1" } : {})])),
    "DELETE /public/lists/rt/reservations/r1": (request) => {
      claimsHeader = request.headers.get("X-Reservation-Claims");
      reserved = false;
      return new Response(null, { status: 204 });
    },
  });
  await render(<GuestList />);
  expect(await screen.findByText("Réservé par vous")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("guest.cancel-0"));
  await fireEvent.press(screen.getByTestId("guest.cancel-confirm-0"));
  expect(await screen.findByTestId("guest.offer-0")).toBeOnTheScreen();
  expect(claimsHeader).toBe("claim-1");
  expect(await claimsFor("rt")).toEqual([]);
});

test("jeton de déverrouillage refusé (mot de passe changé) : oublié, et le mot de passe est redemandé", async () => {
  await saveUnlock("rt", "ancien-jeton", "2099-01-01T00:00:00.000Z");
  let sent: string | null = null;
  fakeFetch({
    "GET /public/lists/rt": (request) => {
      sent = request.headers.get("X-Read-Unlock");
      return json(423, { error: { code: "readPasswordRequired", message: "x" }, title: "Liste d'Alex" });
    },
  });
  await render(<GuestList />);
  expect(await screen.findByTestId("guest.password")).toBeOnTheScreen();
  expect(sent).toBe("ancien-jeton");
  expect(await unlockTokenFor("rt")).toBeNull();
});

test("lien d'une idée : seul un lien web s'ouvre (011)", async () => {
  fakeFetch({
    "GET /public/lists/rt": () =>
      json(200, publicList([item("i1", "t1", { url: "https://exemple.test/jeu" }), item("i2", "t1", { url: "tel:0600000000" })])),
  });
  await render(<GuestList />);
  await screen.findByTestId("guest.title");
  expect(screen.getByTestId("guest.link-0")).toBeOnTheScreen();
  expect(screen.queryByTestId("guest.link-1")).toBeNull();
});
