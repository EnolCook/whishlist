import { act, renderHook, waitFor } from "@testing-library/react-native";

import { createList, newListDefaults } from "@/data/lists";
import { apiTransport, resetStore, useMemberList, useMyLists } from "@/data/store";
import { i18n } from "@/i18n";
import { putSnapshot } from "@/offline/snapshot";
import { setTransport, stopSync, syncNow } from "@/offline/sync";

import { fakeFetch, json } from "../helpers/fetch";
import { freshDb } from "../helpers/memory-db";

const summary = (id: string, title: string) => ({
  id,
  title,
  subtitle: null,
  coverImageUrl: null,
  theme: {},
  role: "owner",
  itemCount: 0,
  readUrl: `https://ohyoushouldnt.example.test/l/${id}`,
});

beforeEach(async () => {
  await freshDb();
  resetStore();
  setTransport(apiTransport);
});

afterEach(() => stopSync());

test("useMyLists shows the local copy, then the server's answer, which it stores", async () => {
  await putSnapshot("lists", [summary("w", "Copie locale")], "2026-10-28T14:05:00.000Z");
  let answer: (response: Response) => void = () => {};
  fakeFetch({ "GET /lists": () => new Promise((resolve) => (answer = resolve)) });
  const { result } = await renderHook(() => useMyLists());
  await waitFor(() => expect(result.current.lists.map((list) => list.title)).toEqual(["Copie locale"]));
  answer(json(200, { lists: [summary("w", "Nos envies")] }));
  await waitFor(() => expect(result.current.lists.map((list) => list.title)).toEqual(["Nos envies"]));
  expect(result.current.fetchedAt).not.toBe("2026-10-28T14:05:00.000Z");
});

test("on a network error, the copy stays with its date", async () => {
  await putSnapshot("lists", [summary("w", "Copie locale")], "2026-10-28T14:05:00.000Z");
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError("Network request failed");
  });
  const { result } = await renderHook(() => useMyLists());
  await waitFor(() => expect(result.current.lists).toHaveLength(1));
  await waitFor(() => expect(result.current.refreshing).toBe(false));
  expect(result.current.fetchedAt).toBe("2026-10-28T14:05:00.000Z");
});

test("createList sends id, categoryId and personId chosen by the app", async () => {
  const bodies: unknown[] = [];
  fakeFetch({
    "POST /lists": async (request) => {
      bodies.push(await request.json());
      return json(201, {});
    },
    "GET /lists": () => json(200, { lists: [] }),
  });
  const result = await createList({ title: "Noël", category: "Livres", person: "Alex" }, preview);
  expect(result).toMatchObject({ ok: true, status: "sent" });
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ title: "Noël", category: "Livres", person: "Alex", id: result.listId });
  expect(bodies[0]).toEqual(
    expect.objectContaining({ categoryId: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/), personId: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/) }),
  );
});

const preview = { title: "Liste de Alex", category: "Cadeaux", person: "Alex" };

test("newListDefaults: the site's defaults, numbered against the lists the phone knows", () => {
  const fr = i18n.getFixedT("fr", "home");
  const t = (key: string, vars?: Record<string, string>) => fr(key, vars);
  expect(newListDefaults("Alex", [], t)).toEqual({ title: "Liste de Alex", category: "Cadeaux", person: "Alex" });
  expect(newListDefaults("Alex", ["liste de alex", "Noël"], t).title).toBe("Liste de Alex 2");
  // Nom affiché vide (ancien compte importé) : les libellés de repli du site.
  expect(newListDefaults(" ", [], t)).toEqual({ title: "Ma liste", category: "Cadeaux", person: "Moi" });
  const en = i18n.getFixedT("en", "home");
  expect(newListDefaults("Alex", [], (key, vars) => en(key, vars))).toEqual({ title: "Alex’s list", category: "Gifts", person: "Alex" });
});

test("createList with empty fields: sent empty for the server to fill, without the local preview", async () => {
  const bodies: unknown[] = [];
  fakeFetch({
    "POST /lists": async (request) => {
      bodies.push(await request.json());
      return json(201, {});
    },
    "GET /lists": () => json(200, { lists: [] }),
  });
  const result = await createList({ title: "", category: " ", person: "" }, preview);
  expect(result).toMatchObject({ ok: true, status: "sent" });
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ title: "", category: " ", person: "", id: result.listId });
  expect(bodies[0]).not.toHaveProperty("preview");
});

test("offline, a list created with empty fields shows the defaults; once sent, the server's values replace them", async () => {
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError("Network request failed");
  });
  const created = await createList({ title: "", category: "", person: "" }, preview);
  expect(created).toMatchObject({ ok: true, status: "pending" });
  const { result: mine } = await renderHook(() => useMyLists());
  await waitFor(() => expect(mine.current.lists.map((list) => [list.title, list.localOnly])).toEqual([["Liste de Alex", true]]));
  const { result: opened } = await renderHook(() => useMemberList(created.listId));
  await waitFor(() => expect(opened.current.list?.categories.map((category) => category.label)).toEqual(["Cadeaux"]));
  expect(opened.current.list?.people.map((person) => person.label)).toEqual(["Alex"]);

  // Le serveur a numéroté autrement (une liste créée ailleurs entre-temps) : c'est son nom qui reste.
  fakeFetch({
    "POST /lists": () => json(201, {}),
    "GET /lists": () => json(200, { lists: [summary(created.listId, "Liste de Alex 2")] }),
    [`GET /lists/${created.listId}`]: () => json(404, { error: { code: "notFound", message: "" } }),
  });
  await act(() => syncNow());
  await waitFor(() => expect(mine.current.lists.map((list) => [list.title, list.localOnly])).toEqual([["Liste de Alex 2", false]]));
});
