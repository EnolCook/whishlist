import { getDb } from "./db";

/** Dernière réponse du serveur pour `GET /lists` (`lists`) ou `GET /lists/{id}` (`list:<id>`). */
export type Snapshot<T> = { body: T; fetchedAt: string };

export const listsKey = "lists";
export const subscriptionsKey = "subscriptions";
export const listKey = (listId: string) => `list:${listId}`;
export const publicListKey = (readToken: string) => `publicList:${readToken}`;

export async function getSnapshot<T>(key: string): Promise<Snapshot<T> | null> {
  const db = await getDb();
  const row = await db.first<{ body: string; fetchedAt: string }>(
    "SELECT body, fetchedAt FROM snapshot WHERE key = ?",
    [key],
  );
  return row ? { body: JSON.parse(row.body), fetchedAt: row.fetchedAt } : null;
}

export async function putSnapshot(key: string, body: unknown, fetchedAt = new Date().toISOString()): Promise<void> {
  const db = await getDb();
  await db.run(
    "INSERT INTO snapshot (key, body, fetchedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET body = excluded.body, fetchedAt = excluded.fetchedAt",
    [key, JSON.stringify(body), fetchedAt],
  );
}

export async function removeSnapshot(key: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM snapshot WHERE key = ?", [key]);
}

/** Vide la copie locale et les changements en attente. */
export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.transaction(async () => {
    await db.run("DELETE FROM snapshot");
    await db.run("DELETE FROM outbox");
    await db.run("DELETE FROM meta");
  });
}

/** On ne montre jamais les listes d'un autre compte : tout est vidé si le compte change. */
export async function ensureUser(userId: string): Promise<void> {
  const db = await getDb();
  const row = await db.first<{ value: string }>("SELECT value FROM meta WHERE key = 'userId'");
  if (row?.value === userId) return;
  await db.transaction(async () => {
    await db.run("DELETE FROM snapshot");
    await db.run("DELETE FROM outbox");
    await db.run(
      "INSERT INTO meta (key, value) VALUES ('userId', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [userId],
    );
  });
}
