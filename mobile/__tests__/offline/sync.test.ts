import { ApiError, NetworkError } from "@/api/client";
import { enqueue, listChanges, type Change, type NewChange } from "@/offline/outbox";
import { retryDelay, sendAndWait, setTransport, stopSync, syncNow } from "@/offline/sync";

import { freshDb } from "../helpers/memory-db";

/**
 * Faux serveur : garde les idées créées et reconnaît un renvoi par l'`id` (contrat api-v1-additions).
 * `failNext` simule une coupure avant l'arrivée ; `loseNextResponse`, une réponse perdue après l'enregistrement.
 */
class FakeServer {
  items = new Map<string, string>();
  received: number[] = [];
  refreshed: string[][] = [];
  failNext = 0;
  loseNextResponse = 0;
  refuse = new Map<string, ApiError>();

  async send(change: Change): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new NetworkError();
    }
    const refusal = this.refuse.get(change.targetId);
    if (refusal) throw refusal;
    this.received.push(change.seq);
    if (change.kind === "createItem" && !this.items.has(change.payload.id)) this.items.set(change.payload.id, change.payload.name);
    if (change.kind === "deleteItem") {
      if (!this.items.delete(change.targetId)) throw new ApiError("itemMissing", 404, "missing");
    }
    if (this.loseNextResponse > 0) {
      this.loseNextResponse -= 1;
      throw new NetworkError();
    }
  }

  async refresh(listIds: string[]): Promise<void> {
    this.refreshed.push(listIds);
  }
}

const createItem = (id: string): NewChange => ({
  kind: "createItem",
  listId: "w",
  targetId: id,
  payload: { id, name: `Idée ${id}`, typeId: "t", personId: "p" },
});

let server: FakeServer;

beforeEach(async () => {
  await freshDb();
  server = new FakeServer();
  setTransport(server);
});

afterEach(() => {
  stopSync();
});

test("sends one change at a time in order, removes it and reloads the list", async () => {
  await enqueue(createItem("a"));
  await enqueue(createItem("b"));
  await syncNow();
  expect(server.received).toEqual([1, 2]);
  expect(await listChanges()).toEqual([]);
  expect(server.refreshed).toEqual([["w"]]);
});

test("network error: stops, keeps the change pending and retries later", async () => {
  jest.useFakeTimers();
  try {
    await enqueue(createItem("a"));
    await enqueue(createItem("b"));
    server.failNext = 1;
    await syncNow();
    expect(server.received).toEqual([]);
    expect((await listChanges()).map((change) => change.state)).toEqual(["pending", "pending"]);
    jest.advanceTimersByTime(retryDelay(1));
    jest.useRealTimers();
    await syncNow();
    expect(server.items.size).toBe(2);
  } finally {
    jest.useRealTimers();
  }
});

test("the wait between retries grows and is capped at one minute", () => {
  expect([1, 2, 3, 4].map(retryDelay)).toEqual([1000, 2000, 4000, 8000]);
  expect(retryDelay(20)).toBe(60_000);
});

test("5xx and 401 stop the sending and keep the outbox", async () => {
  for (const error of [new ApiError("serverError", 503, "down"), new ApiError("unauthorized", 401, "sign in")]) {
    await freshDb();
    await enqueue(createItem("a"));
    server.refuse.set("a", error);
    await syncNow();
    expect((await listChanges()).map((change) => change.state)).toEqual(["pending"]);
  }
});

test("a business refusal rejects the change, and the others go on", async () => {
  await enqueue(createItem("a"));
  await enqueue(createItem("b"));
  server.refuse.set("a", new ApiError("typeNotInList", 400, "bad"));
  await syncNow();
  expect((await listChanges()).map((change) => [change.targetId, change.state, change.errorCode])).toEqual([
    ["a", "rejected", "typeNotInList"],
  ]);
  expect([...server.items.keys()]).toEqual(["b"]);
});

test("a deletion answered 404 itemMissing counts as done", async () => {
  await enqueue({ kind: "deleteItem", listId: "w", targetId: "gone", payload: {} });
  await syncNow();
  expect(await listChanges()).toEqual([]);
});

test("lost response then resend of a createItem: the server keeps one idea", async () => {
  await enqueue(createItem("a"));
  server.loseNextResponse = 1;
  await syncNow();
  expect(server.items.size).toBe(1);
  expect((await listChanges())[0].state).toBe("pending");
  stopSync();
  await syncNow();
  expect(server.items.size).toBe(1);
  expect(await listChanges()).toEqual([]);
});

test("sendAndWait tells what happened to the change", async () => {
  expect(await sendAndWait(await enqueue(createItem("a")))).toEqual({ status: "sent" });
  server.refuse.set("b", new ApiError("priceInvalid", 400, "bad"));
  expect(await sendAndWait(await enqueue(createItem("b")))).toEqual({ status: "rejected", errorCode: "priceInvalid" });
  server.failNext = 1;
  expect(await sendAndWait(await enqueue(createItem("c")))).toEqual({ status: "pending" });
});

test("SC-008: 20 changes with random drops all arrive, without duplicates", async () => {
  // Graine fixe : le scénario est le même à chaque exécution.
  let seed = 42;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
  for (let i = 0; i < 20; i++) await enqueue(createItem(`idea-${String(i).padStart(2, "0")}`));
  for (let round = 0; round < 100 && (await listChanges()).length > 0; round++) {
    if (random() < 0.4) server.failNext = 1;
    else if (random() < 0.4) server.loseNextResponse = 1;
    await syncNow();
    stopSync();
  }
  expect(await listChanges()).toEqual([]);
  expect(server.items.size).toBe(20);
  expect([...server.items.keys()].sort()).toEqual(Array.from({ length: 20 }, (_, i) => `idea-${String(i).padStart(2, "0")}`));
});

test("after a move or a copy, both lists are reloaded", async () => {
  const preview = { id: "a", name: "Idée a", typeId: "t", personId: "p", url: null, imageUrl: null, priceCents: null, priceLabel: null, priority: null, archived: false, sortOrder: 0 };
  await enqueue({ kind: "moveItem", listId: "w", targetId: "a", payload: { targetListId: "w2", typeId: "t2", personId: "p2", preview } });
  await syncNow();
  expect(server.refreshed).toEqual([["w", "w2"]]);
});
