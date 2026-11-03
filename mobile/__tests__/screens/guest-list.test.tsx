import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router, useFocusEffect } from "expo-router";

import GuestList from "../../app/guest/[readToken]/index";
import { signIn, signOut } from "@/auth/session";
import { resetStore } from "@/data/store";
import { claimsFor, clearGuestAccess, saveClaim, saveUnlock, unlockTokenFor } from "@/features/guest/storage";
import { i18n } from "@/i18n";
import { getSnapshot, putSnapshot } from "@/offline/snapshot";

import { fakeFetch, json, me } from "../helpers/fetch";
import { publicItem as item, publicList } from "../helpers/public-list";
import { freshDb } from "../helpers/memory-db";

const params: { readToken: string; typeId?: string; preview?: string } = { readToken: "rt" };
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => params,
  useFocusEffect: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

beforeEach(async () => {
  await freshDb();
  resetStore();
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

// 012 : suivre une liste depuis sa vue, la relire hors ligne, la quitter même verrouillée.

const signedIn = () => signIn({ token: "t", expiresAt: "2099-01-01T00:00:00.000Z", user: me });

const summary = {
  id: "w",
  readToken: "rt",
  title: "Liste d'Alex",
  subtitle: null,
  coverImageUrl: null,
  theme: {},
  itemCount: 2,
  readUrl: "https://api.example.test/l/rt",
  subscribedAt: "2026-11-02T10:00:00.000Z",
  locked: false,
};

test("avec un compte : suivre la liste, puis ne plus la suivre après confirmation", async () => {
  await signedIn();
  let subscribed = false;
  let body: unknown = null;
  fakeFetch({
    "GET /public/lists/rt": () => json(200, { ...publicList(), subscribed }),
    "POST /subscriptions": async (request) => {
      body = await request.json();
      subscribed = true;
      return json(201, summary);
    },
    "DELETE /subscriptions/rt": () => {
      subscribed = false;
      return new Response(null, { status: 204 });
    },
    "GET /lists": () => json(200, { lists: [], subscriptions: subscribed ? [summary] : [] }),
  });
  await render(<GuestList />);
  await fireEvent.press(await screen.findByTestId("guest.follow"));
  expect(body).toEqual({ urlOrToken: "rt" });
  await fireEvent.press(await screen.findByTestId("guest.unfollow"));
  await fireEvent.press(await screen.findByTestId("guest.unfollow-confirm"));
  expect(await screen.findByTestId("guest.follow")).toBeOnTheScreen();
  expect(subscribed).toBe(false);
});

test("suivre une liste déverrouillée sur ce téléphone envoie sa preuve de déverrouillage", async () => {
  await signedIn();
  await saveUnlock("rt", "unlock-1", "2099-01-01T00:00:00.000Z");
  let proof: string | null = null;
  fakeFetch({
    "GET /public/lists/rt": () => json(200, publicList()),
    "POST /subscriptions": (request) => {
      proof = request.headers.get("X-Read-Unlock");
      return json(201, summary);
    },
    "GET /lists": () => json(200, { lists: [], subscriptions: [summary] }),
  });
  await render(<GuestList />);
  await fireEvent.press(await screen.findByTestId("guest.follow"));
  await waitFor(() => expect(proof).toBe("unlock-1"));
});

test("pas de bouton « Suivre » sans compte, ni pour un membre qui regarde en invité", async () => {
  fakeFetch({ "GET /public/lists/rt": () => json(200, publicList()) });
  await render(<GuestList />);
  await screen.findByTestId("guest.title");
  expect(screen.queryByTestId("guest.follow")).toBeNull();

  await signedIn();
  params.preview = "1";
  fakeFetch({ "GET /public/lists/rt": () => json(200, { ...publicList(), isMember: true }) });
  await render(<GuestList />);
  await screen.findByTestId("guest.title");
  expect(screen.queryByTestId("guest.follow")).toBeNull();
  expect(screen.queryByTestId("guest.unfollow")).toBeNull();
});

test("une liste suivie se relit hors ligne ; une liste seulement ouverte par son lien, non", async () => {
  await signedIn();
  fakeFetch({ "GET /public/lists/rt": () => json(200, { ...publicList(), subscribed: true }) });
  await render(<GuestList />);
  await screen.findByTestId("guest.title");
  await waitFor(async () => expect(await getSnapshot("publicList:rt")).not.toBeNull());

  globalThis.fetch = jest.fn(async () => {
    throw new TypeError("Network request failed");
  });
  await render(<GuestList />);
  expect(await screen.findByText("Idée i1")).toBeOnTheScreen();

  // Ne plus la suivre (ici, la relire non suivie) efface la copie : hors ligne, plus rien à montrer.
  fakeFetch({ "GET /public/lists/rt": () => json(200, publicList()) });
  await render(<GuestList />);
  await screen.findByTestId("guest.title");
  await waitFor(async () => expect(await getSnapshot("publicList:rt")).toBeNull());
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError("Network request failed");
  });
  await render(<GuestList />);
  expect(await screen.findByTestId("guest.retry")).toBeOnTheScreen();
});

test("filtres « Pour qui ? » et budget, idées triées par envie puis dans l'ordre du propriétaire", async () => {
  const list = {
    ...publicList([
      item("i1", "t1", { priority: "2", personId: "p" }),
      item("i2", "t1", { priority: "5", personId: "q", priceCents: 4500, priceLabel: "45,00 €" }),
      item("i3", "t1", { priority: "2", personId: "q" }),
    ]),
    people: [
      { id: "p", label: "Alex" },
      { id: "q", label: "Sacha" },
    ],
  };
  fakeFetch({ "GET /public/lists/rt": () => json(200, list) });
  await render(<GuestList />);
  await screen.findByTestId("guest.title");
  expect(screen.getByTestId("guest.item-0")).toHaveTextContent(/Idée i2/);
  expect(screen.getByTestId("guest.item-1")).toHaveTextContent(/Idée i1/);
  expect(screen.getByTestId("guest.item-2")).toHaveTextContent(/Idée i3/);

  await fireEvent.press(screen.getByRole("tab", { name: "Sacha" }));
  expect(screen.queryByText("Idée i1")).toBeNull();
  expect(screen.getByText("Idée i3")).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("tab", { name: i18n.t("public:budgets.under-20") }));
  expect(screen.queryByText("Idée i2")).toBeNull();
  expect(screen.getByText("Idée i3")).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("tab", { name: i18n.t("public:budgets.over-100") }));
  expect(screen.getByTestId("guest.empty")).toHaveTextContent(/Aucune idée ne correspond à ces filtres/);
});

test("liste suivie dont le mot de passe a changé : on peut ne plus la suivre sans la déverrouiller", async () => {
  await signedIn();
  await putSnapshot("subscriptions", [{ ...summary, locked: true }]);
  let deleted = false;
  fakeFetch({
    "GET /public/lists/rt": () =>
      json(423, { error: { code: "readPasswordRequired", message: "x" }, title: "Liste d'Alex" }),
    "DELETE /subscriptions/rt": () => {
      deleted = true;
      return new Response(null, { status: 204 });
    },
    "GET /lists": () => json(200, { lists: [], subscriptions: [] }),
  });
  await render(<GuestList />);
  expect(await screen.findByTestId("guest.password")).toBeOnTheScreen();
  await fireEvent.press(await screen.findByTestId("guest.unfollow"));
  await fireEvent.press(await screen.findByTestId("guest.unfollow-confirm"));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  expect(deleted).toBe(true);
});

test("de retour sur la liste (après une réservation) : elle est relue", async () => {
  const { calls } = fakeFetch({ "GET /public/lists/rt": () => json(200, publicList()) });
  await render(<GuestList />);
  await screen.findByTestId("guest.title");
  expect(calls).toEqual(["GET /public/lists/rt"]);
  const onFocus = jest.mocked(useFocusEffect).mock.lastCall![0];
  onFocus(); // première prise de focus, à l'ouverture : déjà lue
  onFocus(); // retour sur l'écran
  await waitFor(() => expect(calls).toEqual(["GET /public/lists/rt", "GET /public/lists/rt"]));
});
