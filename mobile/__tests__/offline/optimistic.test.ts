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
  priority: null, secondHandOk: false,
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
