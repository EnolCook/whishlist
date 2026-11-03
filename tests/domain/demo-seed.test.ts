import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { importTemplate } from "../../src/domain/import";
import { emptyDatabase, type SeedFile } from "../../src/domain/types";

test("fixture démo couvre liste, archive et réservation sans données réelles", async () => {
  const seed = JSON.parse(await readFile("data/demo-seed.json", "utf8")) as SeedFile;
  assert.equal(seed.items.length, 9);
  assert.equal(seed.items.some((item) => item.archived), true);
  assert.equal(seed.items.some((item) => item.url === null), true);
  assert.equal(seed.items.some((item) => item.priceCents === null), true);
  assert.deepEqual(
    seed.people.map((person) => person.label),
    ["Alex", "Camille", "Nous deux"],
  );

  const imported = importTemplate(emptyDatabase(), "demo-list", seed);
  assert.equal(imported.items.length, 9);
  assert.equal(imported.items.every((item) => item.wishlistId === "demo-list"), true);
  assert.equal(imported.items.some((item) => item.id === "demo-list:jeu"), true);
});

test("base de démo : les comptes sont vérifiés, utilisables sans e-mail", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "wl-demo-"));
  try {
    await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "scripts/create-demo-data.mjs", path.join(dir, "demo.json")],
      { env: { ...process.env, DEMO_PASSWORD: "demo-password-ok" } },
    );
    const db = new Database(path.join(dir, "demo.db"), { readonly: true });
    const users = db.prepare("SELECT created_at, email_verified_at FROM users").all() as {
      created_at: string;
      email_verified_at: string | null;
    }[];
    db.close();
    assert.equal(users.length, 3);
    for (const user of users) assert.equal(user.email_verified_at, user.created_at);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
