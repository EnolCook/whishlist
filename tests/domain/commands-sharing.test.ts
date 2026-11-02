import assert from "node:assert/strict";
import { before, test } from "node:test";
import { verifyReadUnlock } from "../../src/auth/read-unlock";
import { readPublicList, unlockPublicList } from "../../src/server/commands/public-list";
import {
  clearReadPassword,
  deleteList,
  joinInvite,
  leave,
  regenerateInvite,
  removeMember,
  sendInvite,
  setReadPassword,
} from "../../src/server/commands/sharing";
import { isRateLimitError } from "../../src/server/rate-limit";
import { readDocument } from "../../src/store/db";
import { apiDoc, ctx, ensurePasswordHash, TEST_SECRET, withStore } from "./helpers/api-fixtures";
import { withEnv } from "./helpers/env";

before(ensurePasswordHash);

function docWithCamille() {
  const doc = apiDoc();
  doc.memberships.push({ wishlistId: "w", userId: "camille", role: "member", joinedAt: "2026-01-03T00:00:00.000Z" });
  return doc;
}

test("régénérer le lien d'invitation invalide l'ancien", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const result = await regenerateInvite(ctx(doc.users[0]!), { wishlistId: "w" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.notEqual(result.inviteToken, "it");
    assert.equal(result.inviteUrl, `https://ohyoushouldnt.example.test/inviter/${result.inviteToken}`);
    assert.deepEqual(await joinInvite(ctx(doc.users[1]!), { token: "it" }), { ok: false, error: "inviteLinkBroken" });
    const joined = await joinInvite(ctx(doc.users[1]!), { token: result.inviteToken });
    assert.equal(joined.ok && joined.list.role, "member");
  });
});

test("mot de passe de lecture : longueur minimale, déverrouillage périmé au changement, retrait", async () => {
  const doc = apiDoc();
  const alex = ctx(doc.users[0]!);
  await withStore(doc, async () => {
    assert.deepEqual(await setReadPassword(alex, { wishlistId: "w", password: "court" }), {
      ok: false,
      error: "readPasswordTooShort",
    });
    assert.equal((await setReadPassword(alex, { wishlistId: "w", password: "lecture-demo" })).ok, true);
    const unlocked = await unlockPublicList(ctx(), { readToken: "rt", password: "lecture-demo" });
    assert.ok(unlocked.ok && unlocked.unlockToken);
    const token = unlocked.ok ? unlocked.unlockToken : null;
    assert.equal((await setReadPassword(alex, { wishlistId: "w", password: "autre-lecture" })).ok, true);
    const list = (await readDocument()).wishlists[0]!;
    assert.equal(verifyReadUnlock(list, token, TEST_SECRET), false);

    assert.equal((await clearReadPassword(alex, { wishlistId: "w" })).ok, true);
    const open = await readPublicList(ctx(), { readToken: "rt", isUnlocked: () => false, claimedIds: new Set() });
    assert.equal(open.ok, true);
  });
});

test("seul le propriétaire supprime la liste ; un membre la quitte", async () => {
  const doc = docWithCamille();
  await withStore(doc, async () => {
    assert.deepEqual(await deleteList(ctx(doc.users[1]!), { wishlistId: "w" }), { ok: false, error: "ownerDeleteList" });
    assert.equal((await leave(ctx(doc.users[1]!), { wishlistId: "w" })).ok, true);
    assert.equal((await readDocument()).memberships.length, 1);
    assert.equal((await deleteList(ctx(doc.users[0]!), { wishlistId: "w" })).ok, true);
    assert.equal((await readDocument()).wishlists.length, 0);
  });
});

test("le propriétaire retire un membre", async () => {
  const doc = docWithCamille();
  await withStore(doc, async () => {
    assert.deepEqual(await removeMember(ctx(doc.users[1]!), { wishlistId: "w", userId: "alex" }), {
      ok: false,
      error: "ownerRemoveMember",
    });
    assert.equal((await removeMember(ctx(doc.users[0]!), { wishlistId: "w", userId: "camille" })).ok, true);
  });
});

test("inviter par e-mail : adresse requise, e-mail non configuré, 8 envois par heure", async () => {
  const doc = apiDoc();
  const alex = ctx(doc.users[0]!);
  await withEnv({ RESEND_API_KEY: undefined }, () =>
    withStore(doc, async () => {
      assert.deepEqual(await sendInvite(alex, { wishlistId: "w", email: "" }), { ok: false, error: "emailRequired" });
      assert.deepEqual(await sendInvite(alex, { wishlistId: "w", email: "sam@example.test" }), {
        ok: false,
        error: "mailNotConfigured",
      });
      for (let i = 0; i < 6; i += 1) await sendInvite(alex, { wishlistId: "w", email: "sam@example.test" });
      await assert.rejects(sendInvite(alex, { wishlistId: "w", email: "sam@example.test" }), isRateLimitError);
    }),
  );
});

test("un non-membre ne partage rien", async () => {
  const doc = apiDoc();
  const camille = ctx(doc.users[1]!);
  await withStore(doc, async () => {
    for (const attempt of [
      await regenerateInvite(camille, { wishlistId: "w" }),
      await setReadPassword(camille, { wishlistId: "w", password: "lecture-demo" }),
      await clearReadPassword(camille, { wishlistId: "w" }),
      await removeMember(camille, { wishlistId: "w", userId: "alex" }),
      await leave(camille, { wishlistId: "w" }),
      await deleteList(camille, { wishlistId: "w" }),
      await sendInvite(camille, { wishlistId: "w", email: "sam@example.test" }),
    ]) {
      assert.deepEqual(attempt, { ok: false, error: "notMember" });
    }
  });
});
