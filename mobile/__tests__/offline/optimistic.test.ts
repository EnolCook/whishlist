import type { Schemas } from "@/api/client";
import { viewList, viewLists } from "@/offline/optimistic";
import type { Change, NewChange } from "@/offline/outbox";

const item: Schemas["MemberItem"] = {
  id: "gift",
  name: "Livre",
  typeId: "t",
  personId: "p",
  url: null,
  imageUrl: null,
  priceCents: 1990,
  priceLabel: "19,90 €",
  priority: null, secondHandOk: false, description: null,
  archived: false,
  sortOrder: 0,
};

const list: Schemas["MemberList"] = {
  id: "w",
  title: "Nos envies",
  subtitle: null,
  coverImageUrl: null,
  theme: {},
  role: "owner",
  readUrl: "https://ohyoushouldnt.example.test/l/rt",
  inviteUrl: "https://ohyoushouldnt.example.test/i/it",
  hasReadPassword: false,
  categories: [{ id: "t", label: "Livres", sortOrder: 0 }],
  people: [{ id: "p", label: "Alex" }],
  items: [item, { ...item, id: "gift2", name: "Jeu", sortOrder: 1 }],
  reservations: [],
  members: [],
};

let seq = 0;
function change(fields: NewChange, state: Change["state"] = "pending"): Change {
  seq += 1;
  return { ...fields, seq, state, errorCode: state === "rejected" ? "itemMissing" : null, attempts: 0, createdAt: "2026-10-28" };
}

test("the view is the snapshot plus the outbox applied in order", () => {
  const view = viewList(
    list,
    "w",
    [
      change({ kind: "createItem", listId: "w", targetId: "new", payload: { id: "new", name: "Puzzle", typeId: "t", personId: "p", price: "24,90" } }),
      change({ kind: "updateItem", listId: "w", targetId: "gift", payload: { name: "Livre relié", typeId: "t", personId: "p", price: "" } }),
      change({ kind: "patchItem", listId: "w", targetId: "gift2", payload: { archived: true } }),
      change({ kind: "createItem", listId: "other", targetId: "elsewhere", payload: { id: "elsewhere", name: "x", typeId: "t", personId: "p" } }),
    ],
    "fr-FR",
  );
  expect(view?.items.map((entry) => [entry.id, entry.name, entry.archived, entry.pending])).toEqual([
    ["gift", "Livre relié", false, true],
    ["gift2", "Jeu", true, true],
    ["new", "Puzzle", false, true],
  ]);
  const created = view?.items.find((entry) => entry.id === "new");
  expect(created).toMatchObject({ priceCents: 2490, sortOrder: 2 });
  expect(created?.priceLabel).toMatch(/24,90/);
  expect(view?.items.find((entry) => entry.id === "gift")?.priceCents).toBeNull();
});

test("a pending deletion hides the idea; a rejected one shows it with its error", () => {
  const hidden = viewList(list, "w", [change({ kind: "deleteItem", listId: "w", targetId: "gift", payload: {} })], "fr-FR");
  expect(hidden?.items.map((entry) => entry.id)).toEqual(["gift2"]);
  const refused = change({ kind: "updateItem", listId: "w", targetId: "gift", payload: { name: "X", typeId: "t", personId: "p" } }, "rejected");
  const shown = viewList(list, "w", [refused], "fr-FR");
  expect(shown?.items[0]).toMatchObject({ pending: false, rejected: { seq: refused.seq, errorCode: "itemMissing", kind: "updateItem" } });
});

test("a list created offline appears in My lists and opens without a public link", () => {
  const changes = [
    change({
      kind: "createList",
      listId: "new-list",
      targetId: "new-list",
      payload: { id: "new-list", title: "Anniversaire", category: "Jeux", person: "Lou", categoryId: "c1", personId: "p1" },
    }),
    change({ kind: "createItem", listId: "new-list", targetId: "i1", payload: { id: "i1", name: "Puzzle", typeId: "c1", personId: "p1" } }),
  ];
  const lists = viewLists([{ id: "w", title: "Nos envies", subtitle: null, coverImageUrl: null, theme: {}, role: "owner", itemCount: 2, readUrl: list.readUrl }], changes);
  expect(lists.map((entry) => [entry.id, entry.pending, entry.localOnly, entry.itemCount])).toEqual([
    ["w", false, false, 2],
    ["new-list", true, true, 1],
  ]);
  const opened = viewList(null, "new-list", changes, "fr-FR");
  expect(opened).toMatchObject({ title: "Anniversaire", readUrl: "", localOnly: true, pending: true });
  expect(opened?.categories).toEqual([{ id: "c1", label: "Jeux", sortOrder: 0 }]);
  expect(opened?.items.map((entry) => entry.id)).toEqual(["i1"]);
});

test("an unknown list without a pending creation has no view", () => {
  expect(viewList(null, "missing", [], "fr-FR")).toBeNull();
});

test("description: shown from the outbox, cleared by an empty one, kept by a change queued before the field existed", () => {
  const described = { ...list, items: [{ ...item, description: "Pour lire au lit." }] };
  const base = { name: "Livre", typeId: "t", personId: "p" };
  const show = (payload: NewChange["payload"]) =>
    viewList(described, "w", [change({ kind: "updateItem", listId: "w", targetId: "gift", payload } as NewChange)], "fr-FR")?.items[0]?.description;
  expect(show({ ...base, description: "  Relié, si possible.  " })).toBe("Relié, si possible.");
  expect(show({ ...base, description: "" })).toBeNull();
  expect(show(base)).toBe("Pour lire au lit.");
  const created = viewList(list, "w", [change({ kind: "createItem", listId: "w", targetId: "n", payload: { id: "n", ...base } })], "fr-FR");
  expect(created?.items.find((entry) => entry.id === "n")?.description).toBeNull();
});

describe("move and copy", () => {
  const christmas: Schemas["MemberList"] = {
    ...list,
    id: "w2",
    title: "Noël",
    categories: [{ id: "t2", label: "Divers", sortOrder: 0 }],
    people: [{ id: "p2", label: "Alex" }],
    items: [],
  };
  const transfer = { targetListId: "w2", typeId: "t2", personId: "p2", preview: item };
  const move = (state: Change["state"] = "pending") =>
    change({ kind: "moveItem", listId: "w", targetId: "gift", payload: transfer }, state);

  test("a queued move hides the idea in its list and shows it, pending, in the target list", () => {
    const changes = [move()];
    expect(viewList(list, "w", changes, "fr-FR")?.items.map((entry) => entry.id)).toEqual(["gift2"]);
    const arrived = viewList(christmas, "w2", changes, "fr-FR")?.items;
    expect(arrived).toEqual([expect.objectContaining({ id: "gift", name: "Livre", typeId: "t2", personId: "p2", pending: true })]);
  });

  test("a refused move leaves the idea in its list, with the reason, and nothing in the target", () => {
    const refused = move("rejected");
    expect(viewList(list, "w", [refused], "fr-FR")?.items[0]).toMatchObject({ id: "gift", rejected: { seq: refused.seq, kind: "moveItem" } });
    expect(viewList(christmas, "w2", [refused], "fr-FR")?.items).toEqual([]);
  });

  test("a queued copy appears in the target list; in the same list, right after the original", () => {
    const other = change({ kind: "copyItem", listId: "w", targetId: "copy1", payload: { ...transfer, id: "copy1" } });
    expect(viewList(christmas, "w2", [other], "fr-FR")?.items.map((entry) => entry.id)).toEqual(["copy1"]);
    expect(viewList(list, "w", [other], "fr-FR")?.items.map((entry) => entry.id)).toEqual(["gift", "gift2"]);
    const here = change({ kind: "copyItem", listId: "w", targetId: "copy2", payload: { targetListId: "w", typeId: "t", personId: "p", preview: item, id: "copy2" } });
    const shown = viewList(list, "w", [here], "fr-FR")?.items.sort((a, b) => a.sortOrder - b.sortOrder).map((entry) => entry.id);
    expect(shown).toEqual(["gift", "copy2", "gift2"]);
  });
});
