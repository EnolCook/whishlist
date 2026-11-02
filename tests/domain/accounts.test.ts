import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyDatabase } from "../../src/domain/types";
import { registerUser } from "../../src/domain/users";
import { readDocument, updateDocument } from "../../src/store/db";
import { withTempDataPath } from "./helpers/temp-store";

test("e-mail unique, casse, nom vide, hash", async () => {
  const first = await registerUser(emptyDatabase(), {
    email: " Ada@Example.com ",
    password: "secret-ok!!",
    displayName: "Ada",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.value.email, "ada@example.com");
  // Nouveau compte : adresse à confirmer (010).
  assert.equal(first.value.emailVerifiedAt, null);
  assert.notEqual(first.value.passwordHash, "secret-ok!!");
  const second = await registerUser(first.doc, {
    email: "ada@example.com",
    password: "autre-ok!!!",
    displayName: "Ada",
  });
  assert.equal(second.ok, false);
  const blank = await registerUser(emptyDatabase(), {
    email: "a@b.c",
    password: "secret-ok!!",
    displayName: "   ",
  });
  assert.equal(blank.ok, false);
  const short = await registerUser(emptyDatabase(), {
    email: "short@example.com",
    password: "short",
    displayName: "Sam",
  });
  assert.equal(short.ok, false);
  if (!short.ok) assert.equal(short.error, "passwordTooShort");
});

test("deux inscriptions simultanées du même e-mail", async () => {
  await withTempDataPath(async () => {
    const input = { email: "same@example.com", password: "secret-ok!!", displayName: "Sam" };
    await Promise.all([
      updateDocument(async (doc) => {
        const result = await registerUser(doc, input);
        return { doc: result.ok ? result.doc : doc, result };
      }),
      updateDocument(async (doc) => {
        const result = await registerUser(doc, input);
        return { doc: result.ok ? result.doc : doc, result };
      }),
    ]);
    const doc = await readDocument();
    assert.equal(doc.users.length, 1);
  });
});
