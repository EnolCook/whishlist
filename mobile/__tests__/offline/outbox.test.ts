import {
  discard,
  enqueue,
  listChanges,
  markSending,
  reject,
  resetSending,
  retry,
  type ChangePayloads,
  type NewChange,
} from "@/offline/outbox";

import { freshDb } from "../helpers/memory-db";

const input: ChangePayloads["updateItem"] = { name: "Puzzle", typeId: "t", personId: "p", price: "24,90" };

const createItem = (id: string, listId = "w"): NewChange => ({
  kind: "createItem",
  listId,
  targetId: id,
  payload: { ...input, id },
});
const updateItem = (id: string, name: string): NewChange => ({
  kind: "updateItem",
  listId: "w",
  targetId: id,
  payload: { ...input, name },
});
const patchItem = (id: string, payload: ChangePayloads["patchItem"]): NewChange => ({
  kind: "patchItem",
  listId: "w",
  targetId: id,
  payload,
});
const deleteItem = (id: string): NewChange => ({ kind: "deleteItem", listId: "w", targetId: id, payload: {} });
const createList = (id: string): NewChange => ({
  kind: "createList",
  listId: id,
  targetId: id,
  payload: { id, title: "Anniversaire", category: "Jeux", person: "Lou", categoryId: `${id}-t`, personId: `${id}-p` },
});

beforeEach(async () => {
  await freshDb();
});

test("changes are kept in the order they were made", async () => {
  await enqueue(patchItem("a", { archived: true }));
  await enqueue(createItem("b"));
  await enqueue(updateItem("c", "Livre"));
  expect((await listChanges()).map((change) => [change.seq, change.kind, change.targetId])).toEqual([
    [1, "patchItem", "a"],
    [2, "createItem", "b"],
    [3, "updateItem", "c"],
  ]);
});

describe("compaction of pending changes", () => {
  test("several updates of the same idea: the last one keeps the final state", async () => {
    await enqueue(updateItem("a", "Un"));
    await enqueue(updateItem("a", "Deux"));
    const changes = await listChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "updateItem", payload: { name: "Deux" } });
  });

  test("several patches merge into one", async () => {
    await enqueue(patchItem("a", { archived: true }));
    await enqueue(patchItem("a", { typeId: "t2" }));
    const changes = await listChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].payload).toEqual({ archived: true, typeId: "t2" });
  });

  test("createItem then deleteItem: both disappear", async () => {
    await enqueue(createItem("a"));
    await enqueue(updateItem("a", "Autre"));
    expect(await enqueue(deleteItem("a"))).toBeNull();
    expect(await listChanges()).toEqual([]);
  });

  test("createItem then updateItem: a single createItem with the final values", async () => {
    const seq = await enqueue(createItem("a"));
    expect(await enqueue(updateItem("a", "Nom final"))).toBe(seq);
    const changes = await listChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "createItem", payload: { id: "a", name: "Nom final" } });
  });

  test("a change being sent is never compacted", async () => {
    const seq = await enqueue(updateItem("a", "Un"));
    await markSending(seq ?? 0);
    await enqueue(updateItem("a", "Deux"));
    expect((await listChanges()).map((change) => change.state)).toEqual(["sending", "pending"]);
  });

  test("deleteItem of a sent idea removes its pending updates and is kept", async () => {
    await enqueue(updateItem("a", "Un"));
    await enqueue(deleteItem("a"));
    expect((await listChanges()).map((change) => change.kind)).toEqual(["deleteItem"]);
  });
});

test("a change interrupted while sending goes back to pending at startup", async () => {
  const seq = await enqueue(createItem("a"));
  await markSending(seq ?? 0);
  await resetSending();
  expect((await listChanges())[0].state).toBe("pending");
});

describe("dependencies", () => {
  test("a rejected createList rejects the changes of that list with the same code", async () => {
    const seq = await enqueue(createList("new-list"));
    await enqueue(createItem("i1", "new-list"));
    await enqueue(createItem("other", "w"));
    await reject(seq ?? 0, "listNeedsTitle");
    expect((await listChanges()).map((change) => [change.targetId, change.state, change.errorCode])).toEqual([
      ["new-list", "rejected", "listNeedsTitle"],
      ["i1", "rejected", "listNeedsTitle"],
      ["other", "pending", null],
    ]);
  });

  test("a change added after a rejected parent is rejected with it", async () => {
    const seq = await enqueue(createList("new-list"));
    await reject(seq ?? 0, "listNeedsTitle");
    await enqueue(createItem("i1", "new-list"));
    expect((await listChanges())[1]).toMatchObject({ state: "rejected", errorCode: "listNeedsTitle" });
  });

  test("retry sends the corrected change again, with its dependents", async () => {
    const seq = (await enqueue(createList("new-list"))) ?? 0;
    await enqueue(createItem("i1", "new-list"));
    await reject(seq, "listNeedsTitle");
    await retry(seq, {
      id: "new-list",
      title: "Corrigé",
      category: "Jeux",
      person: "Lou",
      categoryId: "new-list-t",
      personId: "new-list-p",
    });
    const changes = await listChanges();
    expect(changes.map((change) => change.state)).toEqual(["pending", "pending"]);
    expect(changes[0].payload).toMatchObject({ title: "Corrigé" });
  });

  test("discard removes the rejected change and its dependents only", async () => {
    const seq = (await enqueue(createList("new-list"))) ?? 0;
    await enqueue(createItem("i1", "new-list"));
    await enqueue(createItem("other", "w"));
    await reject(seq, "listNeedsTitle");
    await discard(seq);
    expect((await listChanges()).map((change) => change.targetId)).toEqual(["other"]);
  });
});

const preview = { id: "a", name: "Puzzle", typeId: "t", personId: "p", url: null, imageUrl: null, priceCents: null, priceLabel: null, priority: null, archived: false, sortOrder: 0 };
const moveItem = (id: string): NewChange => ({
  kind: "moveItem",
  listId: "w",
  targetId: id,
  payload: { targetListId: "w2", typeId: "t2", personId: "p2", preview: { ...preview, id } },
});

test("deleting a moved idea keeps the pending move: the deletion is for the idea in its new list", async () => {
  await enqueue(moveItem("a"));
  await enqueue({ kind: "deleteItem", listId: "w2", targetId: "a", payload: {} });
  expect((await listChanges()).map((row) => row.kind)).toEqual(["moveItem", "deleteItem"]);
});

test("an idea never sent, then moved, then deleted: nothing is left to send", async () => {
  await enqueue(createItem("a"));
  await enqueue(moveItem("a"));
  await enqueue({ kind: "deleteItem", listId: "w2", targetId: "a", payload: {} });
  expect(await listChanges()).toEqual([]);
});
