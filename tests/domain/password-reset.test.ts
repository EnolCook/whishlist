import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPasswordReset,
  findValidPasswordReset,
  resetPasswordWithToken,
} from "../../src/domain/password-reset";
import { createEmailVerification, pendingEmailChange, requestEmailChange } from "../../src/domain/email-confirmation";
import { authenticate, changePassword, registerUser } from "../../src/domain/users";
import { emptyDatabase } from "../../src/domain/types";

test("reset : token, expiration, usage unique, e-mail inconnu silencieux", async () => {
  const registered = await registerUser(emptyDatabase(), {
    email: "ada@example.com",
    password: "ancien-mdp!",
    displayName: "Ada",
  });
  assert.equal(registered.ok, true);
  if (!registered.ok) return;

  const unknown = createPasswordReset(registered.doc, { email: "personne@example.com" });
  assert.equal(unknown.token, null);
  assert.equal(unknown.doc.passwordResets.length, 0);

  const now = new Date("2026-10-19T12:00:00.000Z");
  const created = createPasswordReset(registered.doc, { email: " Ada@Example.com ", now });
  assert.ok(created.token);
  assert.equal(created.email, "ada@example.com");
  assert.equal(created.doc.passwordResets.length, 1);
  assert.equal(findValidPasswordReset(created.doc, created.token!, now), true);

  const expired = await resetPasswordWithToken(created.doc, {
    token: created.token!,
    password: "nouveau-mdp",
    now: new Date("2026-10-19T14:00:01.000Z"),
  });
  assert.equal(expired.ok, false);

  const reset = await resetPasswordWithToken(created.doc, {
    token: created.token!,
    password: "nouveau-mdp",
    now,
  });
  assert.equal(reset.ok, true);
  if (!reset.ok) return;
  assert.equal((await authenticate(reset.doc, "ada@example.com", "nouveau-mdp"))?.id, reset.userId);
  assert.equal(await authenticate(reset.doc, "ada@example.com", "ancien-mdp!"), null);
  assert.equal(reset.doc.passwordResets.length, 0);

  const reuse = await resetPasswordWithToken(reset.doc, {
    token: created.token!,
    password: "autre-mdp!!",
    now,
  });
  assert.equal(reuse.ok, false);
});

test("reset réussi : l'adresse est vérifiée et le lien de confirmation en cours n'a plus d'objet", async () => {
  const registered = await registerUser(emptyDatabase(), {
    email: "sam@example.test",
    password: "ancien-mdp!",
    displayName: "Sam",
  });
  assert.ok(registered.ok);
  assert.equal(registered.value.emailVerifiedAt, null);
  const now = new Date("2026-11-01T10:00:00.000Z");
  const verification = createEmailVerification(registered.doc, { userId: registered.value.id, now });
  assert.ok(verification.ok);
  const created = createPasswordReset(verification.doc, { email: "sam@example.test", now });
  const reset = await resetPasswordWithToken(created.doc, { token: created.token!, password: "nouveau-mdp", now });
  assert.ok(reset.ok);
  assert.equal(reset.doc.users[0].emailVerifiedAt, now.toISOString());
  assert.deepEqual(reset.doc.emailConfirmations, []);
});

test("reset ou changement de mot de passe : un changement d'adresse en attente ne vaut plus rien", async () => {
  const registered = await registerUser(emptyDatabase(), {
    email: "sam@example.test",
    password: "ancien-mdp!",
    displayName: "Sam",
  });
  assert.ok(registered.ok);
  const now = new Date("2026-11-01T10:00:00.000Z");
  const userId = registered.value.id;
  const requested = await requestEmailChange(registered.doc, {
    userId,
    email: "intrus@example.test",
    currentPassword: "ancien-mdp!",
    immediate: false,
    now,
  });
  assert.ok(requested.ok);
  assert.equal(pendingEmailChange(requested.doc, userId, now), "intrus@example.test");

  const created = createPasswordReset(requested.doc, { email: "sam@example.test", now });
  const reset = await resetPasswordWithToken(created.doc, { token: created.token!, password: "nouveau-mdp", now });
  assert.ok(reset.ok);
  assert.equal(pendingEmailChange(reset.doc, userId, now), null);

  const changed = await changePassword(requested.doc, { userId, password: "nouveau-mdp", currentPassword: "ancien-mdp!" });
  assert.ok(changed.ok);
  assert.equal(pendingEmailChange(changed.doc, userId, now), null);
});
