# Data Model: S'abonner à des listes pour suivre leur contenu

**Feature**: `012-list-subscriptions` | **Date**: 2026-11-02

## 1. Entité du domaine (`src/domain/types.ts`)

```ts
export interface Subscription {
  wishlistId: string;
  userId: string;
  /**
   * Empreinte du mot de passe de lecture de la liste au moment où l'abonnement
   * a été créé ou déverrouillé (`null` si la liste n'était pas protégée).
   * Si la liste change de mot de passe (`wishlist.readPasswordHash !== subscription.readPasswordHash`),
   * l'abonné doit saisir le nouveau mot de passe pour consulter à nouveau le contenu.
   */
  readPasswordHash: string | null;
  createdAt: string;
}
```

Ajout dans `Database` :
```ts
export interface Database {
  // ... existants
  subscriptions: Subscription[];
}
```

## 2. Table SQLite (`src/store/schema.ts` & migration Drizzle)

```ts
export const subscriptions = sqliteTable(
  "subscriptions",
  {
    wishlistId: text("wishlist_id")
      .notNull()
      .references(() => wishlists.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    readPasswordHash: text("read_password_hash"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.wishlistId, table.userId] }),
    index("subscriptions_user_id").on(table.userId),
  ],
);
```

## 3. Invariants et règles métier (`src/domain/subscription.ts`, `membership.ts`, `account.ts`)

1. **Unicité** : un couple `(wishlistId, userId)` ne peut exister qu'une seule fois dans `subscriptions`. S'abonner une seconde fois met éventuellement à jour `readPasswordHash` et retourne l'abonnement existant (`replayed: true`), sans erreur ni doublon.
2. **Exclusion mutuelle avec `memberships`** :
   - Un membre de `wishlistId` ne peut pas s'y abonner (`alreadyMember`).
   - Lorsqu'un utilisateur rejoint une liste via `acceptInvite`, toute entrée `subscriptions` pour `(wishlistId, userId)` est supprimée dans la même transaction.
3. **Protection par mot de passe de lecture** :
   - Un abonnement est considéré déverrouillé si et seulement si `wishlist.readPasswordHash === null` ou `subscription.readPasswordHash === wishlist.readPasswordHash`.
   - Dans le cas contraire, la liste suivie est marquée `locked: true` dans `SubscribedListSummary`, son `itemCount` est masqué (`0`), et `canAccessPublicListWith` refuse la lecture tant qu'un déverrouillage valide n'est pas fourni.
   - Lorsqu'un abonné déverrouille la liste avec le nouveau mot de passe (`unlockPublicList`), `subscription.readPasswordHash` est mis à jour à `wishlist.readPasswordHash`.
4. **Suppression en cascade** :
   - `wipeWishlist(doc, wishlistId)` retire toutes les entrées `subscriptions` où `s.wishlistId === wishlistId`.
   - `deleteAccount(doc, { userId })` retire toutes les entrées `subscriptions` où `s.userId === userId`.
5. **Confidentialité et export RGPD (`exportAccount`)** :
   - Les membres d'une liste ne voient jamais `subscriptions` dans leur vue membre ni dans leur export.
   - L'export d'un compte inclut `subscriptions: { title: string; subtitle: string | null; publicUrl: string; subscribedAt: string }[]` pour les listes que ce compte suit.

## 4. Stockage local de l'app mobile (`mobile/src/offline/snapshot.ts`)

Aucune migration SQLite mobile n'est requise : la table `snapshot (key TEXT PRIMARY KEY, body TEXT, fetchedAt TEXT)` stocke déjà des clés arbitraires :
- `subscriptions` : dernière liste `SubscribedListSummary[]` reçue de `GET /lists`.
- `publicList:<readToken>` : dernière réponse `PublicList` reçue de `GET /public/lists/{readToken}` pour permettre la consultation hors ligne d'une liste suivie déjà ouverte (US2 scénario 4).
- À la déconnexion ou suppression du compte, `clearAll()` vide déjà toute la table `snapshot`.
