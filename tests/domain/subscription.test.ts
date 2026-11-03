import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptInvite, deleteWishlist } from "../../src/domain/membership";
import { extractReadToken } from "../../src/domain/read-link";
import {
  findSubscription,
  followedListsOf,
  isSubscriptionUnlocked,
  subscribeWishlist,
  syncSubscriptionUnlock,
  unsubscribeWishlist,
  viewerRelation,
} from "../../src/domain/subscription";
import { accountDoc } from "./helpers/account-fixtures";

test("extractReadToken accepte un jeton brut, un chemin /l/ ou /en/l/, et une URL complète", () => {
  assert.equal(extractReadToken("read-other-123456"), "read-other-123456");
  assert.equal(extractReadToken("  read-other-123456  "), "read-other-123456");
  assert.equal(extractReadToken("/l/read-other-123456"), "read-other-123456");
  assert.equal(extractReadToken("/en/l/read-other-123456/"), "read-other-123456");
  assert.equal(extractReadToken("/fr/l/read-other-123456?qui=p1#cat"), "read-other-123456");
  assert.equal(
    extractReadToken("https://ohyoushouldnt.app/en/l/read-other-123456?budget=20-50#c"),
    "read-other-123456",
  );
  assert.equal(extractReadToken("HTTPS://ohyoushouldnt.app/l/read-other-123456"), "read-other-123456");
  assert.equal(extractReadToken("ohyoushouldnt.app/en/l/read-other-123456"), "read-other-123456");
  assert.equal(extractReadToken("localhost:3000/l/read-other-123456"), "read-other-123456");
  assert.equal(extractReadToken("ohyoushouldnt://l/read-other-123456"), "read-other-123456");
  assert.equal(
    extractReadToken("https://ohyoushouldnt.app/l/read-other-123456/reserver?itemId=i1"),
    "read-other-123456",
  );
  assert.equal(extractReadToken("/l/read-other-123456/types"), "read-other-123456");
  assert.equal(extractReadToken("ohyoushouldnt.app/listes/read-other-123456"), null);
  assert.equal(extractReadToken(""), null);
  assert.equal(extractReadToken("   "), null);
  assert.equal(extractReadToken("court"), null);
  assert.equal(extractReadToken("https://ohyoushouldnt.app/inviter/invite-token-123"), null);
  assert.equal(extractReadToken("https://ohyoushouldnt.app/listes/12345678"), null);
  assert.equal(extractReadToken("http://[invalid"), null);
});

test("subscribeWishlist crée un abonnement et reste idempotent", () => {
  const doc = accountDoc();
  const now = new Date("2026-11-02T10:00:00.000Z");
  const created = subscribeWishlist(doc, { wishlistId: "other", userId: "alex", verifiedHash: null, now });
  assert.ok(created.ok);
  assert.equal(created.replayed, false);
  assert.deepEqual(created.subscription, {
    wishlistId: "other",
    userId: "alex",
    readPasswordHash: null,
    createdAt: "2026-11-02T10:00:00.000Z",
  });

  const again = subscribeWishlist(created.doc, { wishlistId: "other", userId: "alex", verifiedHash: null });
  assert.ok(again.ok);
  assert.equal(again.replayed, true);
  assert.equal(
    again.doc.subscriptions.filter((s) => s.wishlistId === "other" && s.userId === "alex").length,
    1,
  );
});

test("subscribeWishlist refuse alreadyMember, listMissing et accountMissing", () => {
  const doc = accountDoc();
  assert.deepEqual(subscribeWishlist(doc, { wishlistId: "shared", userId: "lou", verifiedHash: null }), {
    ok: false,
    error: "alreadyMember",
  });
  assert.deepEqual(subscribeWishlist(doc, { wishlistId: "shared", userId: "alex", verifiedHash: null }), {
    ok: false,
    error: "alreadyMember",
  });
  assert.deepEqual(subscribeWishlist(doc, { wishlistId: "unknown", userId: "lou", verifiedHash: null }), {
    ok: false,
    error: "listMissing",
  });
  assert.deepEqual(subscribeWishlist(doc, { wishlistId: "other", userId: "ghost", verifiedHash: null }), {
    ok: false,
    error: "accountMissing",
  });
});

test("subscribeWishlist refuse une empreinte qui n'est plus celle de la liste", () => {
  const doc = accountDoc();
  // Accès vérifié contre l'ancien mot de passe, changé par le propriétaire pendant la vérification.
  assert.deepEqual(
    subscribeWishlist(doc, { wishlistId: "alexs", userId: "camille", verifiedHash: "scrypt$old-secret" }),
    { ok: false, error: "readPasswordChanged" },
  );
  // Liste sans mot de passe à la vérification, protégée depuis.
  assert.deepEqual(
    subscribeWishlist(doc, { wishlistId: "alexs", userId: "camille", verifiedHash: null }),
    { ok: false, error: "readPasswordChanged" },
  );
});

test("isSubscriptionUnlocked et syncSubscriptionUnlock suivent le mot de passe de lecture", () => {
  const doc = accountDoc();
  const sub = subscribeWishlist(doc, { wishlistId: "alexs", userId: "camille", verifiedHash: "scrypt$read-secret" });
  assert.ok(sub.ok);
  const list = sub.doc.wishlists.find((w) => w.id === "alexs")!;
  assert.equal(isSubscriptionUnlocked(list, sub.subscription), true);

  // Si le propriétaire change le mot de passe de lecture, l'abonnement devient verrouillé.
  list.readPasswordHash = "scrypt$new-secret";
  assert.equal(isSubscriptionUnlocked(list, sub.subscription), false);

  // Un déverrouillage vérifié contre l'ancienne empreinte ne met rien à jour.
  const stale = syncSubscriptionUnlock(sub.doc, {
    wishlistId: "alexs",
    userId: "camille",
    verifiedHash: "scrypt$read-secret",
  });
  assert.equal(isSubscriptionUnlocked(list, findSubscription(stale, "alexs", "camille")!), false);

  // Après déverrouillage avec le nouveau mot de passe, syncSubscriptionUnlock met à jour l'empreinte.
  const synced = syncSubscriptionUnlock(sub.doc, {
    wishlistId: "alexs",
    userId: "camille",
    verifiedHash: "scrypt$new-secret",
  });
  const updatedSub = findSubscription(synced, "alexs", "camille")!;
  assert.equal(isSubscriptionUnlocked(list, updatedSub), true);
});

test("unsubscribeWishlist retire l'abonnement sans toucher aux réservations", () => {
  const doc = accountDoc();
  const res = unsubscribeWishlist(doc, { wishlistId: "other", userId: "lou" });
  assert.ok(res.ok);
  assert.equal(findSubscription(res.doc, "other", "lou"), null);
  assert.ok(res.doc.reservations.some((r) => r.id === "r-other" && r.userId === "lou"));
  assert.deepEqual(unsubscribeWishlist(res.doc, { wishlistId: "other", userId: "lou" }), {
    ok: false,
    error: "listMissing",
  });
});

test("acceptInvite retire automatiquement l'abonnement existant du nouveau membre", () => {
  const doc = accountDoc();
  assert.ok(findSubscription(doc, "other", "lou"));
  const joined = acceptInvite(doc, { token: "invite-other", userId: "lou" });
  assert.ok(joined.ok);
  assert.equal(findSubscription(joined.doc, "other", "lou"), null);
});

test("deleteWishlist supprime les abonnements de la liste", () => {
  const doc = accountDoc();
  assert.ok(findSubscription(doc, "solo", "camille"));
  const res = deleteWishlist(doc, { wishlistId: "solo", actorId: "lou" });
  assert.ok(res.ok);
  assert.equal(findSubscription(res.doc, "solo", "camille"), null);
});

test("followedListsOf ne garde que les listes suivies dont on n'est pas membre", () => {
  const doc = accountDoc();
  // Lou suit "other" ; on lui ajoute un abonnement à "solo", dont elle est membre.
  doc.subscriptions.push({ wishlistId: "solo", userId: "lou", readPasswordHash: null, createdAt: "2026-04-05T00:00:00.000Z" });
  assert.deepEqual(
    followedListsOf(doc, "lou").map(({ wishlist }) => wishlist.id),
    ["other"],
  );
  // Un abonnement dont la liste a disparu est ignoré.
  doc.wishlists = doc.wishlists.filter((w) => w.id !== "other");
  assert.deepEqual(followedListsOf(doc, "lou"), []);
});

test("viewerRelation distingue membre, abonné et visiteur", () => {
  const doc = accountDoc();
  assert.deepEqual(viewerRelation(doc, "other", "lou"), { isMember: false, subscribed: true });
  assert.deepEqual(viewerRelation(doc, "solo", "lou"), { isMember: true, subscribed: false });
  assert.deepEqual(viewerRelation(doc, "other", "alex"), { isMember: false, subscribed: false });
  assert.deepEqual(viewerRelation(doc, "other", null), { isMember: false, subscribed: false });
});
