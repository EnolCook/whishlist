import { findMembership } from "../domain/access";
import { hasReadPassword } from "../domain/read-password";
import { findSubscription, isSubscriptionUnlocked } from "../domain/subscription";
import type { Database, User, Wishlist } from "../domain/types";
import { hasReadUnlock } from "./read-unlock";

/** Accès page publique : pas de MDP, ou déverrouillage prouvé, ou membre connecté, ou abonné à jour. */
export async function canAccessPublicListWith(
  doc: Database,
  list: Wishlist,
  user: User | null,
  isUnlocked: (list: Wishlist) => boolean | Promise<boolean>,
): Promise<boolean> {
  if (!hasReadPassword(list)) return true;
  if (user && findMembership(doc, list.id, user.id)) return true;
  if (user && !user.mustChangePassword) {
    const subscription = findSubscription(doc, list.id, user.id);
    if (subscription && isSubscriptionUnlocked(list, subscription)) return true;
  }
  return isUnlocked(list);
}

/** Version site : le déverrouillage vient du cookie. */
export async function canAccessPublicList(
  doc: Database,
  list: Wishlist,
  user: User | null,
): Promise<boolean> {
  return canAccessPublicListWith(doc, list, user, hasReadUnlock);
}
