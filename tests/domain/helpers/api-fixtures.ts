import { DEFAULT_WISHLIST_THEME } from "../../../src/domain/theme";
import { emptyDatabase, type Database, type User } from "../../../src/domain/types";
import { resetRateLimitsForTests } from "../../../src/server/rate-limit";
import { replaceDocument } from "../../../src/store/db";
import { withTempDataPath } from "./temp-store";
import type { CommandContext } from "../../../src/server/commands/context";

export const TEST_SECRET = "test-secret-test-secret-test-secret-00";

/** Hash scrypt de "secret-ok!!" (évite de recalculer scrypt dans chaque test). */
export let PASSWORD_HASH = "";
export const PASSWORD = "secret-ok!!";

export async function ensurePasswordHash(): Promise<void> {
  if (PASSWORD_HASH) return;
  const { hashPassword } = await import("../../../src/domain/passwords");
  PASSWORD_HASH = await hashPassword(PASSWORD);
}

export function user(id: string, email: string, displayName: string): User {
  return {
    id,
    email,
    passwordHash: PASSWORD_HASH,
    displayName,
    createdAt: "2026-01-01T00:00:00.000Z",
    mustChangePassword: false,
    sessionVersion: 0,
  };
}

/**
 * Liste `w` (lien de lecture `rt`) : Alex propriétaire, Camille sans accès.
 * Deux idées libres (`gift`, `gift2`) et une idée réservée par quelqu'un d'autre (`taken`).
 */
export function apiDoc(): Database {
  const data = emptyDatabase();
  data.users.push(user("alex", "alex@example.test", "Alex"), user("camille", "camille@example.test", "Camille"));
  data.wishlists.push({
    id: "w",
    title: "Liste d'Alex",
    subtitle: null,
    coverImageUrl: null,
    theme: { ...DEFAULT_WISHLIST_THEME },
    readToken: "rt",
    inviteToken: "it",
    readPasswordHash: null,
    fromTemplate: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  data.memberships.push({ wishlistId: "w", userId: "alex", role: "owner", joinedAt: "2026-01-01T00:00:00.000Z" });
  data.types.push({ id: "t", wishlistId: "w", label: "Jeux", sortOrder: 0 });
  data.people.push({ id: "p", wishlistId: "w", label: "Alex" });
  for (const [id, sortOrder] of [
    ["gift", 0],
    ["gift2", 1],
    ["taken", 2],
  ] as const) {
    data.items.push({
      id,
      wishlistId: "w",
      name: `Idée ${id}`,
      typeId: "t",
      url: null,
      imageUrl: null,
      priceCents: 1990,
      priority: null,
      personId: "p",
      sortOrder,
      archived: id === "taken",
    });
  }
  data.reservations.push({
    id: "r-taken",
    wishlistId: "w",
    itemId: "taken",
    fromName: "Sam",
    note: "Pour ton anniversaire",
    userId: null,
    createdAt: "2026-01-02T00:00:00.000Z",
  });
  return data;
}

export function ctx(current: User | null = null, ip = "203.0.113.1"): CommandContext {
  return { user: current, ip, locale: "fr", origin: "https://ohyoushouldnt.example.test" };
}

/**
 * Lance `run` sur une base temporaire qui contient `doc`, depuis ce dossier
 * (les journaux d'e-mail sans Resend s'écrivent dans `data/` du dossier courant).
 */
export async function withStore(doc: Database, run: () => Promise<void>): Promise<void> {
  await withTempDataPath(async (_dataPath, dir) => {
    const previousSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = TEST_SECRET;
    await replaceDocument(doc);
    const previousCwd = process.cwd();
    process.chdir(dir);
    resetRateLimitsForTests();
    try {
      await run();
    } finally {
      process.chdir(previousCwd);
      if (previousSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previousSecret;
    }
  });
}
