import assert from "node:assert/strict";
import { before, test } from "node:test";
import { setReadPassword } from "../../src/domain/read-password";
import { listMine, readMemberList } from "../../src/server/commands/lists";
import {
  readPublicList,
  reserve,
  subscribeToList,
  unlockPublicList,
  unsubscribeFromList,
} from "../../src/server/commands/public-list";
import { joinInvite, setReadPassword as setReadPasswordCmd } from "../../src/server/commands/sharing";
import { isRateLimitError } from "../../src/server/rate-limit";
import { apiDocWithSecondList, ctx, ensurePasswordHash, withStore } from "./helpers/api-fixtures";

const noUnlock = () => false;
const none = new Set<string>();

before(ensurePasswordHash);

function subDoc() {
  return apiDocWithSecondList();
}

async function protectedSubDoc() {
  const saved = await setReadPassword(subDoc(), {
    wishlistId: "w",
    actorId: "alex",
    password: "lecture-demo",
  });
  assert.equal(saved.ok, true);
  return saved.ok ? saved.doc : subDoc();
}

test("s'abonner par URL ou jeton, retrouver la liste dans listMine et lire ses états subscribed / isMember", async () => {
  const doc = subDoc();
  const alex = doc.users[0]!;
  const camille = doc.users[1]!;

  await withStore(doc, async () => {
    const sub = await subscribeToList(ctx(camille), {
      urlOrToken: "https://ohyoushouldnt.example.test/en/l/rt-alex-1234?qui=p",
      isUnlocked: noUnlock,
    });
    assert.equal(sub.ok, true);
    if (!sub.ok) return;
    assert.equal(sub.replayed, false);
    assert.equal(sub.subscription.id, "w");
    assert.equal(sub.subscription.readToken, "rt-alex-1234");
    assert.equal(sub.subscription.locked, false);
    assert.equal(sub.subscription.itemCount, 2);

    // Idempotence
    const replay = await subscribeToList(ctx(camille), {
      urlOrToken: "rt-alex-1234",
      isUnlocked: noUnlock,
    });
    assert.equal(replay.ok, true);
    if (replay.ok) assert.equal(replay.replayed, true);

    // listMine retourne la liste de Camille dans lists et celle d'Alex dans subscriptions
    const mine = await listMine(ctx(camille));
    assert.equal(mine.ok, true);
    if (mine.ok) {
      assert.deepEqual(mine.lists.map((l) => l.id), ["w-camille"]);
      assert.equal(mine.subscriptions.length, 1);
      assert.equal(mine.subscriptions[0]!.title, "Liste d'Alex");
    }

    // Alex peut aussi s'abonner à la liste de Camille (qui n'est pas la sienne)
    const subAlex = await subscribeToList(ctx(alex), {
      urlOrToken: "https://ohyoushouldnt.example.test/l/rt-camille-1234",
      isUnlocked: noUnlock,
    });
    assert.equal(subAlex.ok, true);
    const mineAlex = await listMine(ctx(alex));
    assert.equal(mineAlex.ok, true);
    if (mineAlex.ok) {
      assert.deepEqual(mineAlex.lists.map((l) => l.id), ["w"]);
      assert.deepEqual(mineAlex.subscriptions.map((s) => s.id), ["w-camille"]);
    }

    // readPublicList indique subscribed: true pour Camille et isMember: true pour Alex
    const pubCamille = await readPublicList(ctx(camille), {
      readToken: "rt-alex-1234",
      isUnlocked: noUnlock,
      claimedIds: none,
    });
    assert.equal(pubCamille.ok, true);
    if (pubCamille.ok) {
      assert.equal(pubCamille.list.subscribed, true);
      assert.equal(pubCamille.list.isMember, false);
    }

    const pubAlex = await readPublicList(ctx(alex), {
      readToken: "rt-alex-1234",
      isUnlocked: noUnlock,
      claimedIds: none,
    });
    assert.equal(pubAlex.ok, true);
    if (pubAlex.ok) {
      assert.equal(pubAlex.list.subscribed, false);
      assert.equal(pubAlex.list.isMember, true);
    }

    // Confidentialité : la vue membre d'Alex ne contient aucune trace de l'abonnement de Camille
    const memberView = await readMemberList(ctx(alex), { wishlistId: "w" });
    assert.equal(memberView.ok, true);
    if (memberView.ok) {
      const json = JSON.stringify(memberView.list);
      assert.equal(json.includes("camille"), false);
      assert.equal(json.includes("Camille"), false);
      assert.equal(json.includes("subscript"), false);
    }
  });
});

test("refus : non connecté, mustChangePassword, déjà membre, lien invalide, liste inconnue ou non suivie", async () => {
  const doc = subDoc();
  const alex = doc.users[0]!;
  const camille = doc.users[1]!;
  const forced = { ...camille, mustChangePassword: true };

  await withStore(doc, async () => {
    assert.deepEqual(
      await subscribeToList(ctx(null), { urlOrToken: "rt-alex-1234" }),
      { ok: false, error: "unauthorized" },
    );
    assert.deepEqual(
      await subscribeToList(ctx(forced), { urlOrToken: "rt-alex-1234" }),
      { ok: false, error: "mustChangePassword" },
    );
    assert.deepEqual(
      await subscribeToList(ctx(alex), { urlOrToken: "rt-alex-1234" }),
      { ok: false, error: "alreadyMember" },
    );
    assert.deepEqual(
      await subscribeToList(ctx(camille), { urlOrToken: "https://ohyoushouldnt.app/inviter/it-alex-1234" }),
      { ok: false, error: "subscriptionLinkInvalid" },
    );
    assert.deepEqual(
      await subscribeToList(ctx(camille), { urlOrToken: "rt-inconnue-1234" }),
      { ok: false, error: "listMissing" },
    );
    assert.deepEqual(
      await unsubscribeFromList(ctx(null), { readToken: "rt-alex-1234" }),
      { ok: false, error: "unauthorized" },
    );
    assert.deepEqual(
      await unsubscribeFromList(ctx(forced), { readToken: "rt-alex-1234" }),
      { ok: false, error: "mustChangePassword" },
    );
    assert.deepEqual(
      await unsubscribeFromList(ctx(camille), { readToken: "rt-inconnue-1234" }),
      { ok: false, error: "listMissing" },
    );
    assert.deepEqual(
      await unsubscribeFromList(ctx(camille), { readToken: "rt-alex-1234" }),
      { ok: false, error: "listMissing" },
    );
  });
});

test("liste protégée par mot de passe : exigé à l'abonnement, accès maintenu, et invalidé si le propriétaire change le MDP", async () => {
  const doc = await protectedSubDoc();
  const alex = doc.users[0]!;
  const camille = doc.users[1]!;

  await withStore(doc, async () => {
    const locked = await subscribeToList(ctx(camille), {
      urlOrToken: "rt-alex-1234",
      isUnlocked: noUnlock,
    });
    assert.deepEqual(locked, {
      ok: false,
      error: "readPasswordRequired",
      title: "Liste d'Alex",
      readToken: "rt-alex-1234",
    });

    const wrong = await subscribeToList(ctx(camille), {
      urlOrToken: "rt-alex-1234",
      password: "faux-password",
      isUnlocked: noUnlock,
    });
    assert.deepEqual(wrong, { ok: false, error: "badPassword" });

    const sub = await subscribeToList(ctx(camille), {
      urlOrToken: "rt-alex-1234",
      password: "lecture-demo",
      isUnlocked: noUnlock,
    });
    assert.equal(sub.ok, true);
    if (!sub.ok) return;
    assert.equal(sub.subscription.locked, false);

    // L'abonnée accède ensuite à la liste sans preuve externe (isUnlocked: noUnlock)
    const read = await readPublicList(ctx(camille), {
      readToken: "rt-alex-1234",
      isUnlocked: noUnlock,
      claimedIds: none,
    });
    assert.equal(read.ok, true);

    // Le propriétaire change le mot de passe de lecture -> l'abonnement devient verrouillé
    const changed = await setReadPasswordCmd(ctx(alex), {
      wishlistId: "w",
      password: "nouveau-secret",
    });
    assert.equal(changed.ok, true);

    const mineLocked = await listMine(ctx(camille));
    assert.equal(mineLocked.ok, true);
    if (mineLocked.ok) {
      assert.equal(mineLocked.subscriptions[0]!.locked, true);
      assert.equal(mineLocked.subscriptions[0]!.itemCount, 0);
    }

    const readAfterChange = await readPublicList(ctx(camille), {
      readToken: "rt-alex-1234",
      isUnlocked: noUnlock,
      claimedIds: none,
    });
    assert.equal(readAfterChange.ok, false);

    // L'abonnée déverrouille avec le nouveau mot de passe -> l'abonnement est de nouveau déverrouillé
    const unlocked = await unlockPublicList(ctx(camille), {
      readToken: "rt-alex-1234",
      password: "nouveau-secret",
    });
    assert.equal(unlocked.ok, true);

    const readAgain = await readPublicList(ctx(camille), {
      readToken: "rt-alex-1234",
      isUnlocked: noUnlock,
      claimedIds: none,
    });
    assert.equal(readAgain.ok, true);
  });
});

test("se désabonner retire l'abonnement mais conserve les réservations, et rejoindre la liste retire l'abonnement", async () => {
  const doc = subDoc();
  const camille = doc.users[1]!;

  await withStore(doc, async () => {
    await subscribeToList(ctx(camille), { urlOrToken: "rt-alex-1234", isUnlocked: noUnlock });
    const res = await reserve(ctx(camille), {
      readToken: "rt-alex-1234",
      itemId: "gift",
      isUnlocked: noUnlock,
    });
    assert.equal(res.ok, true);

    // L'idée réservée par Camille compte toujours dans son itemCount d'abonnée (FR-006)
    const mineWhileReserved = await listMine(ctx(camille));
    assert.equal(mineWhileReserved.ok && mineWhileReserved.subscriptions[0]?.itemCount, 2);

    const unsub = await unsubscribeFromList(ctx(camille), { readToken: "rt-alex-1234" });
    assert.equal(unsub.ok, true);

    const mineAfter = await listMine(ctx(camille));
    assert.equal(mineAfter.ok && mineAfter.subscriptions.length, 0);

    // La réservation de Camille sur "gift" est toujours active
    const pubAfter = await readPublicList(ctx(camille), {
      readToken: "rt-alex-1234",
      isUnlocked: noUnlock,
      claimedIds: none,
    });
    assert.equal(pubAfter.ok, true);
    if (pubAfter.ok) {
      assert.equal(pubAfter.list.items.find((i) => i.id === "gift")?.mine, true);
    }

    // Si Camille se réabonne puis rejoint la liste comme membre, son abonnement disparaît
    await subscribeToList(ctx(camille), { urlOrToken: "rt-alex-1234", isUnlocked: noUnlock });
    const joined = await joinInvite(ctx(camille), { token: "it-alex-1234" });
    assert.equal(joined.ok, true);
    const mineMember = await listMine(ctx(camille));
    assert.equal(mineMember.ok, true);
    if (mineMember.ok) {
      assert.deepEqual(mineMember.lists.map((l) => l.id).sort(), ["w", "w-camille"]);
      assert.equal(mineMember.subscriptions.length, 0);
    }
  });
});

test("31 demandes d'abonnement en 15 minutes : la 31e est refusée", async () => {
  const doc = subDoc();
  const camille = doc.users[1]!;
  await withStore(doc, async () => {
    for (let i = 0; i < 30; i += 1) {
      await subscribeToList(ctx(camille), { urlOrToken: "rt-alex-1234", isUnlocked: noUnlock });
    }
    await assert.rejects(
      subscribeToList(ctx(camille), { urlOrToken: "rt-alex-1234", isUnlocked: noUnlock }),
      isRateLimitError,
    );
  });
});
