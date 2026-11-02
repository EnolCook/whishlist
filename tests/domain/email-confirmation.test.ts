import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cancelEmailChange,
  confirmEmail,
  createEmailVerification,
  findEmailConfirmation,
  isEmailVerified,
  maskEmail,
  mustConfirmEmail,
  pendingEmailChange,
  requestEmailChange,
} from "../../src/domain/email-confirmation";
import { hashSecretToken } from "../../src/domain/tokens";
import { emptyDatabase, type Database } from "../../src/domain/types";
import { authenticate, registerUser } from "../../src/domain/users";

const NOW = new Date("2026-11-01T10:00:00.000Z");

async function newAccount(): Promise<Database> {
  const registered = await registerUser(emptyDatabase(), {
    id: "sam",
    email: "sam@example.test",
    password: "mot-de-passe-ok",
    displayName: "Sam",
    now: NOW,
  });
  assert.ok(registered.ok);
  return registered.doc;
}

test("validation : seul le dernier lien envoyé reste valable, et seule son empreinte est stockée", async () => {
  const doc = await newAccount();
  assert.equal(isEmailVerified(doc.users[0]), false);

  const first = createEmailVerification(doc, { userId: "sam", now: NOW });
  assert.ok(first.ok);
  assert.equal(first.email, "sam@example.test");
  assert.equal(first.doc.emailConfirmations.length, 1);
  const stored = first.doc.emailConfirmations[0];
  assert.equal(stored.purpose, "verify");
  assert.equal(stored.tokenHash, hashSecretToken(first.token));
  assert.notEqual(stored.tokenHash, first.token);
  assert.equal(stored.expiresAt, "2026-11-02T10:00:00.000Z");

  const second = createEmailVerification(first.doc, { userId: "sam", now: NOW });
  assert.ok(second.ok);
  assert.equal(second.doc.emailConfirmations.length, 1);
  assert.deepEqual(confirmEmail(second.doc, { token: first.token, now: NOW }), {
    ok: false,
    error: "confirmationLinkInvalid",
  });

  const confirmed = confirmEmail(second.doc, { token: second.token, now: NOW });
  assert.ok(confirmed.ok);
  assert.equal(confirmed.purpose, "verify");
  assert.equal(confirmed.doc.users[0].emailVerifiedAt, NOW.toISOString());
  assert.equal(isEmailVerified(confirmed.doc.users[0]), true);
  assert.deepEqual(confirmed.doc.emailConfirmations, []);

  // Usage unique.
  assert.deepEqual(confirmEmail(confirmed.doc, { token: second.token, now: NOW }), {
    ok: false,
    error: "confirmationLinkInvalid",
  });
});

test("validation : lien inconnu, vide, expiré ou pour un compte absent", async () => {
  const doc = await newAccount();
  const created = createEmailVerification(doc, { userId: "sam", now: NOW });
  assert.ok(created.ok);

  assert.deepEqual(confirmEmail(created.doc, { token: "inconnu", now: NOW }), {
    ok: false,
    error: "confirmationLinkInvalid",
  });
  assert.deepEqual(confirmEmail(created.doc, { token: "  ", now: NOW }), {
    ok: false,
    error: "confirmationLinkInvalid",
  });
  const later = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
  assert.deepEqual(confirmEmail(created.doc, { token: created.token, now: later }), {
    ok: false,
    error: "confirmationLinkExpired",
  });
  assert.equal(created.doc.users[0].emailVerifiedAt, null);
  assert.deepEqual(createEmailVerification(created.doc, { userId: "personne", now: NOW }), {
    ok: false,
    error: "accountMissing",
  });
});

test("validation : un lien pour une adresse qui n'est plus celle du compte ne vaut plus rien", async () => {
  const doc = await newAccount();
  const created = createEmailVerification(doc, { userId: "sam", now: NOW });
  assert.ok(created.ok);
  created.doc.users[0].email = "sam.b@example.test";
  assert.deepEqual(findEmailConfirmation(created.doc, { token: created.token, now: NOW }), {
    ok: false,
    error: "confirmationLinkInvalid",
  });
});

test("maskEmail : reconnaissable sans être lisible", () => {
  assert.equal(maskEmail("camille@example.test"), "ca•••@example.test");
  assert.equal(maskEmail("al@example.test"), "a•••@example.test");
  assert.equal(maskEmail("a@example.test"), "a•••@example.test");
  assert.equal(maskEmail("pas-une-adresse"), "•••");
});

const PASSWORD = "mot-de-passe-ok";

/** Sam (adresse confirmée) et Lou, qui a déjà `lou@example.test`. */
async function twoAccounts(): Promise<Database> {
  const doc = await newAccount();
  doc.users[0]!.emailVerifiedAt = NOW.toISOString();
  const lou = await registerUser(doc, { id: "lou", email: "lou@example.test", password: PASSWORD, displayName: "Lou", now: NOW });
  assert.ok(lou.ok);
  return lou.doc;
}

function change(doc: Database, email: string, extra: { currentPassword?: string; immediate?: boolean } = {}) {
  return requestEmailChange(doc, {
    userId: "sam",
    email,
    currentPassword: extra.currentPassword ?? PASSWORD,
    immediate: extra.immediate ?? false,
    now: NOW,
  });
}

test("changement : mot de passe actuel exigé, adresse valide, différente et libre", async () => {
  const doc = await twoAccounts();
  assert.deepEqual(await change(doc, "sam.b@example.test", { currentPassword: "mauvais" }), {
    ok: false,
    error: "wrongCurrentPassword",
  });
  assert.deepEqual(await change(doc, "pas-une-adresse"), { ok: false, error: "emailInvalid" });
  assert.deepEqual(await change(doc, "  "), { ok: false, error: "emailInvalid" });
  assert.deepEqual(await change(doc, " Sam@Example.test "), { ok: false, error: "emailUnchanged" });
  assert.deepEqual(await change(doc, "LOU@example.test", { immediate: true }), { ok: false, error: "emailTaken" });
  assert.deepEqual(doc.emailConfirmations, []);
});

test("changement vers l'adresse d'un autre compte : même réponse qu'une adresse libre, refusé à la confirmation", async () => {
  const doc = await twoAccounts();
  const requested = await change(doc, "LOU@example.test");
  assert.ok(requested.ok && requested.token);
  assert.equal(requested.taken, true);
  assert.equal(pendingEmailChange(requested.doc, "sam", NOW), "lou@example.test");
  const refused = confirmEmail(requested.doc, { token: requested.token!, now: NOW });
  assert.equal(refused.ok, false);
  if (refused.ok) return;
  assert.equal(refused.error, "emailTaken");
  assert.equal(refused.doc?.users.find((u) => u.id === "sam")!.email, "sam@example.test");
});

test("changement : un lien part vers la nouvelle adresse, l'adresse de connexion ne change qu'à sa confirmation", async () => {
  const doc = await twoAccounts();
  const first = await change(doc, " Sam.B@Example.test ");
  assert.ok(first.ok && first.token);
  assert.equal(first.email, "sam.b@example.test");
  assert.equal(first.previousEmail, "sam@example.test");
  assert.equal(first.doc.users[0]!.email, "sam@example.test");
  assert.equal(pendingEmailChange(first.doc, "sam", NOW), "sam.b@example.test");
  assert.ok(await authenticate(first.doc, "sam@example.test", PASSWORD));

  // Une nouvelle demande remplace la précédente.
  const second = await change(first.doc, "sam.c@example.test");
  assert.ok(second.ok && second.token);
  assert.equal(second.doc.emailConfirmations.filter((c) => c.purpose === "change").length, 1);
  assert.deepEqual(confirmEmail(second.doc, { token: first.token!, now: NOW }), { ok: false, error: "confirmationLinkInvalid" });

  const confirmed = confirmEmail(second.doc, { token: second.token!, now: NOW });
  assert.ok(confirmed.ok);
  assert.equal(confirmed.purpose, "change");
  assert.equal(confirmed.previousEmail, "sam@example.test");
  assert.equal(confirmed.doc.users[0]!.email, "sam.c@example.test");
  assert.equal(confirmed.doc.users[0]!.emailVerifiedAt, NOW.toISOString());
  assert.deepEqual(confirmed.doc.emailConfirmations, []);
  assert.equal(pendingEmailChange(confirmed.doc, "sam", NOW), null);
  assert.equal(await authenticate(confirmed.doc, "sam@example.test", PASSWORD), null);
  assert.ok(await authenticate(confirmed.doc, "sam.c@example.test", PASSWORD));
});

test("changement : la confirmation efface aussi un lien de validation de l'ancienne adresse", async () => {
  const doc = await newAccount();
  const verification = createEmailVerification(doc, { userId: "sam", now: NOW });
  assert.ok(verification.ok);
  const requested = await change(verification.doc, "sam.b@example.test");
  assert.ok(requested.ok && requested.token);
  const confirmed = confirmEmail(requested.doc, { token: requested.token!, now: NOW });
  assert.ok(confirmed.ok);
  assert.deepEqual(confirmed.doc.emailConfirmations, []);
  assert.notEqual(confirmed.doc.users[0]!.emailVerifiedAt, null);
});

test("changement : annulé, son lien ne vaut plus rien", async () => {
  const requested = await change(await twoAccounts(), "sam.b@example.test");
  assert.ok(requested.ok && requested.token);
  const cancelled = cancelEmailChange(requested.doc, { userId: "sam" });
  assert.equal(pendingEmailChange(cancelled, "sam", NOW), null);
  assert.deepEqual(confirmEmail(cancelled, { token: requested.token!, now: NOW }), {
    ok: false,
    error: "confirmationLinkInvalid",
  });
  // Sans demande en attente : rien ne change.
  assert.deepEqual(cancelEmailChange(cancelled, { userId: "sam" }), cancelled);
});

test("changement : adresse prise entre-temps par un autre compte, refus et adresse inchangée", async () => {
  const requested = await change(await twoAccounts(), "noa@example.test");
  assert.ok(requested.ok && requested.token);
  const taken = await registerUser(requested.doc, { id: "noa", email: "noa@example.test", password: PASSWORD, displayName: "Noa" });
  assert.ok(taken.ok);
  const refused = confirmEmail(taken.doc, { token: requested.token!, now: NOW });
  assert.equal(refused.ok, false);
  if (refused.ok) return;
  assert.equal(refused.error, "emailTaken");
  // La demande, devenue impossible, disparaît ; l'adresse du compte ne bouge pas.
  assert.ok(refused.doc);
  assert.equal(pendingEmailChange(refused.doc, "sam", NOW), null);
  assert.equal(refused.doc.users.find((u) => u.id === "sam")!.email, "sam@example.test");
});

test("changement sans envoi d'e-mail : appliqué tout de suite, adresse vérifiée (FR-015)", async () => {
  const doc = await newAccount();
  const verification = createEmailVerification(doc, { userId: "sam", now: NOW });
  assert.ok(verification.ok);
  const applied = await change(verification.doc, "sam.b@example.test", { immediate: true });
  assert.ok(applied.ok);
  assert.equal(applied.token, null);
  assert.equal(applied.doc.users[0]!.email, "sam.b@example.test");
  assert.equal(applied.doc.users[0]!.emailVerifiedAt, NOW.toISOString());
  assert.deepEqual(applied.doc.emailConfirmations, []);
});

test("changement en attente expiré : plus affiché", async () => {
  const requested = await change(await twoAccounts(), "sam.b@example.test");
  assert.ok(requested.ok);
  assert.equal(pendingEmailChange(requested.doc, "sam", new Date(NOW.getTime() + 24 * 60 * 60 * 1000)), null);
});

test("mustConfirmEmail : seulement si la validation est exigée et l'adresse pas confirmée", async () => {
  const doc = await newAccount();
  const sam = doc.users[0]!;
  assert.equal(mustConfirmEmail(sam, true), true);
  assert.equal(mustConfirmEmail(sam, false), false);
  assert.equal(mustConfirmEmail({ ...sam, emailVerifiedAt: NOW.toISOString() }, true), false);
});
