import assert from "node:assert/strict";
import { before, test } from "node:test";
import { findApiSessionUser } from "../../src/auth/api-session";
import { createPasswordReset } from "../../src/domain/password-reset";
import { authenticate, changePassword } from "../../src/domain/users";
import {
  changeOwnPassword,
  login,
  logout,
  register,
  requestPasswordReset,
  resetPasswordWithLink,
  updateOwnDisplayName,
} from "../../src/server/commands/auth";
import { isRateLimitError } from "../../src/server/rate-limit";
import { readDocument, updateDocument } from "../../src/store/db";
import { apiDoc, ctx, ensurePasswordHash, PASSWORD, withStore } from "./helpers/api-fixtures";

before(ensurePasswordHash);

test("se connecter rend un jeton et le compte, sans le hash", async () => {
  await withStore(apiDoc(), async () => {
    const result = await login(ctx(), { email: "ALEX@example.test ", password: PASSWORD });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.session.user, {
      id: "alex",
      email: "alex@example.test",
      displayName: "Alex",
      mustChangePassword: false,
      emailVerified: true,
      pendingEmail: null,
    });
    assert.ok(Date.parse(result.session.expiresAt) > Date.now());
    assert.equal(findApiSessionUser(await readDocument(), result.session.token)?.id, "alex");
  });
});

test("un mauvais mot de passe et un e-mail inconnu donnent la même erreur", async () => {
  await withStore(apiDoc(), async () => {
    assert.deepEqual(await login(ctx(), { email: "alex@example.test", password: "mauvais-mdp" }), {
      ok: false,
      error: "invalidCredentials",
    });
    assert.deepEqual(await login(ctx(), { email: "personne@example.test", password: PASSWORD }), {
      ok: false,
      error: "invalidCredentials",
    });
  });
});

test("20 connexions en 15 minutes depuis une IP : la 21e est refusée", async () => {
  await withStore(apiDoc(), async () => {
    for (let i = 0; i < 20; i += 1) await login(ctx(), { email: "personne@example.test", password: "x" });
    await assert.rejects(login(ctx(), { email: "alex@example.test", password: PASSWORD }), isRateLimitError);
  });
});

test("se déconnecter tue le jeton de cet appareil seulement", async () => {
  await withStore(apiDoc(), async () => {
    const phone = await login(ctx(), { email: "alex@example.test", password: PASSWORD });
    const tablet = await login(ctx(), { email: "alex@example.test", password: PASSWORD });
    assert.ok(phone.ok && tablet.ok);
    if (!phone.ok || !tablet.ok) return;
    await logout(ctx(), { token: phone.session.token });
    const doc = await readDocument();
    assert.equal(findApiSessionUser(doc, phone.session.token), null);
    assert.equal(findApiSessionUser(doc, tablet.session.token)?.id, "alex");
  });
});

test("un changement de mot de passe invalide tous les jetons émis avant", async () => {
  await withStore(apiDoc(), async () => {
    const tokens = [];
    for (let i = 0; i < 3; i += 1) {
      const result = await login(ctx(), { email: "alex@example.test", password: PASSWORD });
      if (result.ok) tokens.push(result.session.token);
    }
    await updateDocument(async (doc) => {
      const saved = await changePassword(doc, { userId: "alex", password: "nouveau-mdp-solide" });
      return { doc: saved.ok ? saved.doc : doc, result: saved };
    });
    const doc = await readDocument();
    assert.equal(tokens.filter((token) => findApiSessionUser(doc, token)).length, 0);
  });
});

test("s'inscrire : nouveau compte connecté ; e-mail déjà pris sans erreur ni jeton", async () => {
  await withStore(apiDoc(), async () => {
    const created = await register(ctx(), { email: "sam@example.test", password: "mot-de-passe-long", displayName: "Sam" });
    assert.equal(created.ok && created.user?.email, "sam@example.test");
    const taken = await register(ctx(), { email: "alex@example.test", password: "mot-de-passe-long", displayName: "Alex" });
    assert.deepEqual(taken, { ok: true, user: null, verificationUrl: null, mailFailed: false });
    assert.deepEqual(await register(ctx(), { email: "lou@example.test", password: "court", displayName: "Lou" }), {
      ok: false,
      error: "passwordTooShort",
    });
  });
});

test("5 inscriptions par heure depuis une IP", async () => {
  await withStore(apiDoc(), async () => {
    for (let i = 0; i < 5; i += 1) await register(ctx(), { email: "", password: "", displayName: "" });
    await assert.rejects(register(ctx(), { email: "", password: "", displayName: "" }), isRateLimitError);
  });
});

test("changer son mot de passe : l'ancien est vérifié, les autres connexions tombent", async () => {
  await withStore(apiDoc(), async () => {
    const other = await login(ctx(), { email: "alex@example.test", password: PASSWORD });
    assert.ok(other.ok);
    const alex = (await readDocument()).users[0]!;
    assert.deepEqual(
      await changeOwnPassword(ctx(alex), { currentPassword: "faux-mot-de-passe", password: "nouveau-mdp-solide" }),
      { ok: false, error: "wrongCurrentPassword" },
    );
    const changed = await changeOwnPassword(ctx(alex), {
      currentPassword: PASSWORD,
      password: "nouveau-mdp-solide",
      openApiSession: true,
    });
    assert.equal(changed.ok, true);
    if (!changed.ok || !other.ok || !changed.session) return;
    const doc = await readDocument();
    assert.equal(findApiSessionUser(doc, other.session.token), null);
    assert.equal(findApiSessionUser(doc, changed.session.token)?.id, "alex", "le nouveau jeton vient de la même écriture");
  });
});

test("un mot de passe à changer se change sans l'ancien", async () => {
  const doc = apiDoc();
  doc.users[0]!.mustChangePassword = true;
  await withStore(doc, async () => {
    const changed = await changeOwnPassword(ctx(doc.users[0]!), { password: "nouveau-mdp-solide" });
    assert.equal(changed.ok && changed.user.mustChangePassword, false);
  });
});

test("nom affiché : obligatoire", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    assert.deepEqual(await updateOwnDisplayName(ctx(doc.users[0]!), { displayName: " " }), {
      ok: false,
      error: "displayNameRequired",
    });
    const saved = await updateOwnDisplayName(ctx(doc.users[0]!), { displayName: "Alexandra" });
    assert.equal(saved.ok && saved.user.displayName, "Alexandra");
  });
});

test("demander une réinitialisation : même réponse que l'e-mail existe ou non, sans lien en production", async () => {
  const previous = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = "production";
  try {
    await withStore(apiDoc(), async () => {
      const known = await requestPasswordReset(ctx(), { email: "alex@example.test" });
      const unknown = await requestPasswordReset(ctx(), { email: "personne@example.test" });
      assert.deepEqual(known, { ok: true, resetUrl: null });
      assert.deepEqual(unknown, known);
      assert.equal((await readDocument()).passwordResets.length, 1);
    });
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = previous;
  }
});

test("20 essais de changement de mot de passe en 15 minutes : le 21e est refusé", async () => {
  await withStore(apiDoc(), async () => {
    const alex = (await readDocument()).users[0]!;
    for (let i = 0; i < 20; i += 1) {
      await changeOwnPassword(ctx(alex), { currentPassword: "faux-mot-de-passe", password: "nouveau-mdp-solide" });
    }
    await assert.rejects(
      changeOwnPassword(ctx(alex), { currentPassword: PASSWORD, password: "nouveau-mdp-solide" }),
      isRateLimitError,
    );
  });
});

/** Base de démo avec un lien de réinitialisation pour Alex, et ce lien. */
function docWithReset(now?: Date) {
  const created = createPasswordReset(apiDoc(), { email: "alex@example.test", now });
  if (!created.token) throw new Error("lien de réinitialisation non créé");
  created.doc.users[0]!.emailVerifiedAt = null;
  return { doc: created.doc, token: created.token };
}

test("nouveau mot de passe par le lien (011) : changé, adresse vérifiée, autres connexions tombées", async () => {
  const { doc, token } = docWithReset();
  await withStore(doc, async () => {
    const before = (await readDocument()).users[0]!.sessionVersion ?? 0;
    const result = await resetPasswordWithLink(ctx(), { token, password: "nouveau-mdp-solide", signIn: false });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.session, null);
    const after = await readDocument();
    const alex = after.users[0]!;
    assert.equal(alex.sessionVersion, before + 1);
    assert.notEqual(alex.emailVerifiedAt, null);
    assert.equal(after.passwordResets.length, 0);
    assert.equal((await authenticate(after, "alex@example.test", "nouveau-mdp-solide"))?.id, "alex");
  });
});

test("nouveau mot de passe par le lien avec signIn : une session d'API pour ce compte", async () => {
  const { doc, token } = docWithReset();
  await withStore(doc, async () => {
    const result = await resetPasswordWithLink(ctx(), { token, password: "nouveau-mdp-solide", signIn: true });
    assert.equal(result.ok && result.session?.user.id, "alex");
    if (!result.ok || !result.session) return;
    assert.equal(findApiSessionUser(await readDocument(), result.session.token)?.id, "alex");
  });
});

test("nouveau mot de passe par le lien : trop court, lien inconnu, déjà utilisé ou expiré", async () => {
  const { doc, token } = docWithReset();
  await withStore(doc, async () => {
    assert.deepEqual(await resetPasswordWithLink(ctx(), { token, password: "court", signIn: false }), {
      ok: false,
      error: "passwordTooShort",
    });
    assert.deepEqual(await resetPasswordWithLink(ctx(), { token: "inconnu", password: "nouveau-mdp-solide", signIn: true }), {
      ok: false,
      error: "resetLinkInvalid",
    });
    assert.equal((await resetPasswordWithLink(ctx(), { token, password: "nouveau-mdp-solide", signIn: false })).ok, true);
    assert.deepEqual(await resetPasswordWithLink(ctx(), { token, password: "autre-mdp-solide", signIn: false }), {
      ok: false,
      error: "resetLinkInvalid",
    });
  });
  const old = docWithReset(new Date(Date.now() - 2 * 60 * 60 * 1000));
  await withStore(old.doc, async () => {
    assert.deepEqual(await resetPasswordWithLink(ctx(), { token: old.token, password: "nouveau-mdp-solide", signIn: false }), {
      ok: false,
      error: "resetLinkExpired",
    });
  });
});

test("20 essais de nouveau mot de passe par lien en 15 minutes depuis une IP : le 21e est refusé", async () => {
  await withStore(apiDoc(), async () => {
    for (let i = 0; i < 20; i += 1) {
      await resetPasswordWithLink(ctx(), { token: `faux-${i}`, password: "nouveau-mdp-solide", signIn: false });
    }
    await assert.rejects(
      resetPasswordWithLink(ctx(), { token: "faux", password: "nouveau-mdp-solide", signIn: false }),
      isRateLimitError,
    );
  });
});
