import assert from "node:assert/strict";
import { before, test } from "node:test";
import type { Database } from "../../src/domain/types";
import { login, register, requestPasswordReset } from "../../src/server/commands/auth";
import {
  cancelOwnEmailChange,
  confirmEmailWithToken,
  previewEmailConfirmation,
  requestOwnEmailChange,
  resendEmailVerification,
} from "../../src/server/commands/email";
import { createList } from "../../src/server/commands/lists";
import { reserve } from "../../src/server/commands/public-list";
import { joinInvite, sendInvite } from "../../src/server/commands/sharing";
import { isRateLimitError } from "../../src/server/rate-limit";
import { readDocument } from "../../src/store/db";
import {
  apiDoc,
  ctx,
  ensurePasswordHash,
  lastConfirmationToken,
  mailLog,
  PASSWORD,
  withMailDryRun,
  withStore,
} from "./helpers/api-fixtures";
import { withEnv } from "./helpers/env";

before(ensurePasswordHash);

const NEW_LIST = { title: "Ma liste", category: "Livres", person: "Moi" };

/** Alex (propriétaire de « w ») et Camille (sans liste), tous deux à l'adresse non confirmée. */
function unverifiedDoc(): Database {
  const doc = apiDoc();
  for (const user of doc.users) user.emailVerifiedAt = null;
  return doc;
}

test("adresse non confirmée : créer, rejoindre et inviter sont refusés quand la validation est exigée", async () => {
  await withMailDryRun(() =>
    withStore(unverifiedDoc(), async () => {
      const [alex, camille] = (await readDocument()).users;
      assert.deepEqual(await createList(ctx(camille!), NEW_LIST), { ok: false, error: "emailNotVerified" });
      assert.deepEqual(await joinInvite(ctx(camille!), { token: "it" }), { ok: false, error: "emailNotVerified" });
      assert.deepEqual(await sendInvite(ctx(alex!), { wishlistId: "w", email: "lou@example.test" }), {
        ok: false,
        error: "emailNotVerified",
      });
      // Les autres écritures d'un membre restent possibles (R5) ; seule la porte d'entrée est gardée.
      assert.equal((await readDocument()).wishlists.length, 1);
    }),
  );
});

test("adresse confirmée : la garde laisse passer", async () => {
  await withMailDryRun(() =>
    withStore(apiDoc(), async () => {
      const camille = (await readDocument()).users[1]!;
      const created = await createList(ctx(camille), NEW_LIST);
      assert.equal(created.ok, true);
      const joined = await joinInvite(ctx(camille), { token: "it" });
      assert.equal(joined.ok, true);
      // L'envoi simulé ne part pas : la commande va jusqu'à l'envoi, après la garde.
      assert.deepEqual(await sendInvite(ctx(camille), { wishlistId: "w", email: "lou@example.test" }), {
        ok: false,
        error: "mailNotConfigured",
      });
      assert.match(await mailLog(), /invite \(envoi simulé\) -> lou@example\.test/);
    }),
  );
});

test("sans envoi d'e-mail, la validation est absente : rien n'est refusé (FR-008)", async () => {
  await withStore(unverifiedDoc(), async () => {
    const camille = (await readDocument()).users[1]!;
    assert.equal((await createList(ctx(camille), NEW_LIST)).ok, true);
    assert.equal((await joinInvite(ctx(camille), { token: "it" })).ok, true);
    assert.deepEqual(await sendInvite(ctx(camille), { wishlistId: "w", email: "lou@example.test" }), {
      ok: false,
      error: "mailNotConfigured",
    });
  });
});

test("adresse non confirmée : réserver reste possible, avec ou sans compte (US1-7, FR-005)", async () => {
  await withMailDryRun(() =>
    withStore(unverifiedDoc(), async () => {
      const camille = (await readDocument()).users[1]!;
      const noUnlock = () => false;
      const reserved = await reserve(ctx(camille), { readToken: "rt", itemId: "gift", fromName: "Camille", isUnlocked: noUnlock });
      assert.equal(reserved.ok, true);
      assert.equal((await reserve(ctx(), { readToken: "rt", itemId: "gift2", isUnlocked: noUnlock })).ok, true);
    }),
  );
});

test("confirmation : 20 essais par IP en 15 minutes, le 21ᵉ est refusé (R13)", async () => {
  await withStore(apiDoc(), async () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      assert.deepEqual(await confirmEmailWithToken(ctx(), { token: `faux-${attempt}` }), {
        ok: false,
        error: "confirmationLinkInvalid",
      });
    }
    await assert.rejects(confirmEmailWithToken(ctx(), { token: "faux-21" }), isRateLimitError);
    // La limite est par IP : une autre adresse peut encore essayer.
    assert.equal((await confirmEmailWithToken(ctx(null, "203.0.113.9"), { token: "faux" })).ok, false);
  });
});

test("inscription : un lien de confirmation part, avec la suite si c'est un chemin interne", async () => {
  await withMailDryRun(() =>
    withStore(apiDoc(), async () => {
      const created = await register(ctx(), {
        email: "sam@example.test",
        password: "mot-de-passe-long",
        displayName: "Sam",
        next: "/inviter/it",
      });
      assert.ok(created.ok && created.user);
      assert.equal(created.user.emailVerifiedAt, null);
      // En dev, l'e-mail simulé n'est pas parti : le lien est rendu pour l'afficher.
      assert.match(created.verificationUrl ?? "", /^https:\/\/ohyoushouldnt\.example\.test\/confirmer-email\/[\w-]+\?suite=%2Finviter%2Fit$/);
      const log = await mailLog();
      assert.match(log, /email-verification \(envoi simulé\) -> sam@example\.test/);
      const doc = await readDocument();
      assert.deepEqual(
        doc.emailConfirmations.map((c) => [c.userId, c.purpose, c.email]),
        [[created.user.id, "verify", "sam@example.test"]],
      );

      const external = await register(ctx(null, "203.0.113.2"), {
        email: "lou@example.test",
        password: "mot-de-passe-long",
        displayName: "Lou",
        next: "//ailleurs.example",
      });
      assert.ok(external.ok);
      assert.doesNotMatch(external.verificationUrl ?? "", /suite=/);
    }),
  );
});

test("inscription sans envoi d'e-mail : aucun lien, aucune demande", async () => {
  await withStore(apiDoc(), async () => {
    const created = await register(ctx(), { email: "sam@example.test", password: "mot-de-passe-long", displayName: "Sam" });
    assert.ok(created.ok);
    assert.equal(created.verificationUrl, null);
    assert.deepEqual((await readDocument()).emailConfirmations, []);
    assert.equal(await mailLog(), "");
  });
});

test("confirmation : l'adresse n'est lisible en entier que par son compte, et la suite reste interne", async () => {
  await withMailDryRun(() =>
    withStore(apiDoc(), async () => {
      const created = await register(ctx(), { email: "sam@example.test", password: "mot-de-passe-long", displayName: "Sam" });
      assert.ok(created.ok && created.user);
      const token = await lastConfirmationToken();

      const stranger = await previewEmailConfirmation(ctx(), { token });
      assert.deepEqual(stranger, { ok: true, purpose: "verify", email: "sa•••@example.test", ownAccount: false });
      const own = await previewEmailConfirmation(ctx(created.user), { token });
      assert.deepEqual(own, { ok: true, purpose: "verify", email: "sam@example.test", ownAccount: true });

      const confirmed = await confirmEmailWithToken(ctx(), { token, suite: "https://ailleurs.example" });
      assert.deepEqual(confirmed, { ok: true, purpose: "verify", suite: null, ownAccount: false });
      const sam = (await readDocument()).users.find((u) => u.id === created.user!.id)!;
      assert.notEqual(sam.emailVerifiedAt, null);
      assert.deepEqual(await confirmEmailWithToken(ctx(), { token }), { ok: false, error: "confirmationLinkInvalid" });
    }),
  );
});

test("renvoi du lien : le nouveau confirme, l'ancien ne vaut plus rien (US2)", async () => {
  await withMailDryRun(() =>
    withStore(unverifiedDoc(), async () => {
      const camille = (await readDocument()).users[1]!;
      const first = await resendEmailVerification(ctx(camille));
      assert.ok(first.ok);
      assert.equal(first.sent, false); // envoi simulé
      const oldToken = await lastConfirmationToken();
      const second = await resendEmailVerification(ctx(camille));
      assert.ok(second.ok);
      const newToken = await lastConfirmationToken();
      assert.notEqual(newToken, oldToken);
      assert.equal((await readDocument()).emailConfirmations.length, 1);
      assert.deepEqual(await confirmEmailWithToken(ctx(), { token: oldToken }), {
        ok: false,
        error: "confirmationLinkInvalid",
      });
      assert.equal((await confirmEmailWithToken(ctx(), { token: newToken })).ok, true);
    }),
  );
});

test("renvoi du lien : refusé à un compte vérifié, sans validation exigée, ou qui doit changer son mot de passe", async () => {
  await withMailDryRun(() =>
    withStore(apiDoc(), async () => {
      const alex = (await readDocument()).users[0]!;
      assert.deepEqual(await resendEmailVerification(ctx(alex)), { ok: false, error: "emailAlreadyVerified" });
      assert.deepEqual(await resendEmailVerification(ctx({ ...alex, emailVerifiedAt: null, mustChangePassword: true })), {
        ok: false,
        error: "mustChangePassword",
      });
      assert.deepEqual(await resendEmailVerification(ctx()), { ok: false, error: "unauthorized" });
      assert.equal(await mailLog(), "");
    }),
  );
  await withStore(unverifiedDoc(), async () => {
    const camille = (await readDocument()).users[1]!;
    assert.deepEqual(await resendEmailVerification(ctx(camille)), { ok: false, error: "emailAlreadyVerified" });
  });
});

test("renvoi du lien : 5 par heure et par compte, la 6e demande est refusée", async () => {
  await withMailDryRun(() =>
    withStore(unverifiedDoc(), async () => {
      const camille = (await readDocument()).users[1]!;
      for (let i = 0; i < 5; i += 1) assert.equal((await resendEmailVerification(ctx(camille))).ok, true);
      await assert.rejects(resendEmailVerification(ctx(camille)), isRateLimitError);
    }),
  );
});

test("changement d'adresse : lien vers la nouvelle, connexion inchangée jusqu'à la confirmation, avis à l'ancienne (US3)", async () => {
  await withMailDryRun(() =>
    withStore(apiDoc(), async () => {
      const camille = (await readDocument()).users[1]!;
      const requested = await requestOwnEmailChange(ctx(camille), { email: "Camille.B@example.test", currentPassword: PASSWORD });
      assert.ok(requested.ok);
      assert.equal(requested.me.email, "camille@example.test");
      assert.equal(requested.me.pendingEmail, "camille.b@example.test");
      assert.match(await mailLog(), /email-change \(envoi simulé\) -> camille\.b@example\.test/);
      assert.equal((await login(ctx(), { email: "camille@example.test", password: PASSWORD })).ok, true);

      const token = await lastConfirmationToken();
      const preview = await previewEmailConfirmation(ctx(camille), { token });
      assert.deepEqual(preview, { ok: true, purpose: "change", email: "camille.b@example.test", ownAccount: true });
      const confirmed = await confirmEmailWithToken(ctx(), { token });
      assert.deepEqual(confirmed, { ok: true, purpose: "change", suite: null, ownAccount: false });

      const log = await mailLog();
      const notice = log.slice(log.lastIndexOf("email-changed"));
      assert.match(notice, /^email-changed \(envoi simulé\) -> camille@example\.test/);
      assert.match(notice, /ca•••@example\.test/);
      assert.doesNotMatch(notice, /camille\.b@example\.test|confirmer-email|mot-de-passe-oublie/);
      assert.match(notice, /contact@ohyoushouldnt\.app/);

      assert.deepEqual(await login(ctx(), { email: "camille@example.test", password: PASSWORD }), {
        ok: false,
        error: "invalidCredentials",
      });
      assert.equal((await login(ctx(), { email: "camille.b@example.test", password: PASSWORD })).ok, true);
      // La réinitialisation part vers la nouvelle adresse seulement (FR-016).
      await requestPasswordReset(ctx(), { email: "camille@example.test" });
      await requestPasswordReset(ctx(), { email: "camille.b@example.test" });
      const resets = [...(await mailLog()).matchAll(/password-reset \([^)]*\) -> (\S+)/g)].map((m) => m[1]);
      assert.deepEqual(resets, ["camille.b@example.test"]);
    }),
  );
});

test("changement d'adresse : mauvais mot de passe, adresse d'un autre compte, rien n'est envoyé", async () => {
  await withMailDryRun(() =>
    withStore(apiDoc(), async () => {
      const camille = (await readDocument()).users[1]!;
      assert.deepEqual(await requestOwnEmailChange(ctx(camille), { email: "camille.b@example.test", currentPassword: "faux" }), {
        ok: false,
        error: "wrongCurrentPassword",
      });
      // Adresse d'un autre compte : même réponse qu'une adresse libre, et rien ne part vers elle.
      const taken = await requestOwnEmailChange(ctx(camille), { email: "alex@example.test", currentPassword: PASSWORD });
      assert.ok(taken.ok);
      assert.equal(taken.sent, true);
      assert.equal(taken.me.pendingEmail, "alex@example.test");
      assert.deepEqual(await requestOwnEmailChange(ctx(), { email: "x@example.test", currentPassword: PASSWORD }), {
        ok: false,
        error: "unauthorized",
      });
      assert.equal(await mailLog(), "");
    }),
  );
});

test("changement d'adresse : annulé, le lien reçu ne vaut plus rien", async () => {
  await withMailDryRun(() =>
    withStore(apiDoc(), async () => {
      const camille = (await readDocument()).users[1]!;
      assert.ok((await requestOwnEmailChange(ctx(camille), { email: "camille.b@example.test", currentPassword: PASSWORD })).ok);
      const token = await lastConfirmationToken();
      const cancelled = await cancelOwnEmailChange(ctx(camille));
      assert.ok(cancelled.ok);
      assert.equal(cancelled.me.pendingEmail, null);
      assert.deepEqual(await confirmEmailWithToken(ctx(), { token }), { ok: false, error: "confirmationLinkInvalid" });
    }),
  );
});

test("changement d'adresse : la même adresse demandée par deux comptes revient au premier qui confirme", async () => {
  await withMailDryRun(() =>
    withStore(apiDoc(), async () => {
      const [alex, camille] = (await readDocument()).users;
      assert.ok((await requestOwnEmailChange(ctx(alex!), { email: "nous@example.test", currentPassword: PASSWORD })).ok);
      const alexToken = await lastConfirmationToken();
      assert.ok((await requestOwnEmailChange(ctx(camille!), { email: "nous@example.test", currentPassword: PASSWORD })).ok);
      const camilleToken = await lastConfirmationToken();
      assert.equal((await confirmEmailWithToken(ctx(), { token: camilleToken })).ok, true);
      assert.deepEqual(await confirmEmailWithToken(ctx(), { token: alexToken }), { ok: false, error: "emailTaken" });
      const doc = await readDocument();
      assert.equal(doc.users.find((u) => u.id === "alex")!.email, "alex@example.test");
      assert.equal(doc.users.find((u) => u.id === "camille")!.email, "nous@example.test");
      // La demande d'Alex, devenue impossible, a disparu.
      assert.deepEqual(doc.emailConfirmations, []);
    }),
  );
});

test("changement d'adresse sans envoi d'e-mail : appliqué tout de suite (FR-015)", async () => {
  await withStore(apiDoc(), async () => {
    const camille = (await readDocument()).users[1]!;
    assert.deepEqual(await requestOwnEmailChange(ctx(camille), { email: "alex@example.test", currentPassword: PASSWORD }), {
      ok: false,
      error: "emailTaken",
    });
    const applied = await requestOwnEmailChange(ctx(camille), { email: "camille.b@example.test", currentPassword: PASSWORD });
    assert.ok(applied.ok);
    assert.equal(applied.me.email, "camille.b@example.test");
    assert.equal(applied.me.pendingEmail, null);
    assert.equal(await mailLog(), "");
    assert.equal((await login(ctx(), { email: "camille.b@example.test", password: PASSWORD })).ok, true);
  });
});

test("changement d'adresse : 5 demandes par heure et par compte", async () => {
  await withMailDryRun(() =>
    withStore(apiDoc(), async () => {
      const camille = (await readDocument()).users[1]!;
      for (let i = 0; i < 5; i += 1) {
        await requestOwnEmailChange(ctx(camille), { email: `camille${i}@example.test`, currentPassword: PASSWORD });
      }
      await assert.rejects(
        requestOwnEmailChange(ctx(camille), { email: "camille9@example.test", currentPassword: PASSWORD }),
        isRateLimitError,
      );
    }),
  );
});

test("inscription : un refus de Resend est signalé, pour le nouveau compte comme pour une adresse déjà inscrite", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("down", { status: 503 });
  try {
    await withEnv({ RESEND_API_KEY: "re_test", MAIL_FROM: "noreply@example.test", MAIL_DRY_RUN: undefined }, () =>
      withStore(apiDoc(), async () => {
        const created = await register(ctx(), { email: "sam@example.test", password: "mot-de-passe-long", displayName: "Sam" });
        assert.ok(created.ok && created.user);
        assert.equal(created.mailFailed, true);
        const taken = await register(ctx(), { email: "alex@example.test", password: "mot-de-passe-long", displayName: "Alex" });
        assert.deepEqual(taken, { ok: true, user: null, verificationUrl: null, mailFailed: true });
      }),
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});
