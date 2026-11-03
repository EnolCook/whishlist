# Research: S'abonner à des listes pour suivre leur contenu

**Feature**: `012-list-subscriptions` | **Date**: 2026-11-02

## R1 — Modèle de données et persistance SQLite

- **Decision**: Ajouter la collection `subscriptions: Subscription[]` au type `Database` (`src/domain/types.ts`) et la table `subscriptions` dans `src/store/schema.ts`, avec une clé primaire composite `(wishlistId, userId)` (même convention que `memberships`), un index sur `userId` (`subscriptions_user_id`), et les colonnes :
  - `wishlistId` (`text`, FK vers `wishlists.id`, non null)
  - `userId` (`text`, FK vers `users.id`, non null)
  - `readPasswordHash` (`text`, nullable) : l'empreinte du mot de passe de lecture de la liste au moment où l'abonnement a été créé ou déverrouillé (voir R3)
  - `createdAt` (`text`, ISO 8601, non null)
- **Rationale**:
  - La clé composite `(wishlistId, userId)` garantit au niveau SQL qu'un compte ne peut s'abonner qu'une seule fois à une même liste, exactement comme `memberships`.
  - Dans `src/store/legacy-json.ts`, `subscriptions` est ajoutée à `OPTIONAL` et initialisée à `[]` dans `normalizeDocument` si absente d'un ancien fichier JSON.
  - Une migration Drizzle (`drizzle/0001_*.sql`) est générée via `npm run db:generate` et appliquée automatiquement au démarrage (`migrateAndImport`).
- **Alternatives considered**:
  - Clé primaire `id` séparée + index unique `(wishlistId, userId)` : inutilement différent de `memberships`, qui utilise déjà la clé composite `wishlistId/userId` dans `src/store/rows.ts`.

## R2 — Extraction d'un `readToken` depuis un lien collé

- **Decision**: Créer une fonction pure `extractReadToken(raw: string): string | null` dans `src/domain/subscription.ts` (partagée entre serveur et app mobile). Elle accepte :
  1. Une URL complète (`https://.../l/<token>`, `https://.../en/l/<token>`, avec ou sans query string / hash) et en extrait le segment après `/l/`.
  2. Un chemin relatif (`/l/<token>`, `/en/l/<token>`).
  3. Un jeton brut valide (base64url / alphanumérique `^[A-Za-z0-9_-]{8,128}$`).
  Toute autre chaîne (vide, URL vers une autre route comme `/inviter/...`, caractères invalides) retourne `null` (erreur `subscriptionLinkInvalid`).
- **Rationale**: Sur mobile ou sur le site, l'utilisateur copie-colle généralement l'URL complète reçue par message (`https://ohyoushouldnt.app/l/abc...`), parfois avec `?qui=...` ou `#cat-...`. Extraire proprement le `readToken` évite toute erreur de manipulation.
- **Alternatives considered**:
  - Exiger uniquement le jeton brut : inutilisable en pratique car personne ne découpe une URL à la main.

## R3 — Gestion des listes protégées par mot de passe de lecture

- **Decision**:
  1. **À l'abonnement** :
     - Si la liste n'a pas de mot de passe de lecture (`wishlist.readPasswordHash === null`), l'abonnement est enregistré avec `subscription.readPasswordHash = null`.
     - Si la liste a un mot de passe de lecture :
       - Soit l'appelant détient déjà une preuve de déverrouillage valide (cookie `hasReadUnlock` sur le site ou en-tête `X-Read-Unlock` sur l'API),
       - Soit l'appelant fournit `password` dans la demande d'abonnement (vérifié avec `verifyReadPassword`, protégé par `rateLimitForIp`).
       - Si l'un des deux est valide, l'abonnement enregistre `subscription.readPasswordHash = wishlist.readPasswordHash`. Sinon, la commande répond `{ ok: false, error: "readPasswordRequired", title: wishlist.title, readToken: wishlist.readToken }` (ou `badPassword` si un mot de passe erroné a été fourni).
  2. **À la consultation ultérieure** (`canAccessPublicListWith`) :
     - Un abonné connecté dont `subscription.readPasswordHash === wishlist.readPasswordHash` a accès à la liste sans ressaisir le mot de passe (sur le site comme dans l'app mobile, même après les 14 jours du cookie invité).
     - Si le propriétaire de la liste ajoute ou modifie le mot de passe de lecture (`wishlist.readPasswordHash` change), `subscription.readPasswordHash !== wishlist.readPasswordHash` : la liste est marquée `locked: true` et l'abonné doit saisir le nouveau mot de passe. Lorsqu'il déverrouille la liste étant connecté (`unlockPublicList`), `subscription.readPasswordHash` est mis à jour avec la nouvelle empreinte.
- **Rationale**:
  - Respecte strictement FR-003 et les cas limites : l'abonnement ne contourne jamais le mot de passe de lecture, et un changement de mot de passe par le propriétaire invalide immédiatement l'accès des abonnés jusqu'à saisie du nouveau mot de passe.
  - Évite à l'abonné de devoir ressaisir le mot de passe tous les 14 jours ou sur chacun de ses appareils tant que le propriétaire n'a pas changé le mot de passe de la liste.
- **Alternatives considered**:
  - Stocker uniquement `unlockToken` dans le téléphone : obligerait à redéverrouiller sur chaque appareil et expirerait au bout de 14 jours alors que l'abonnement est attaché au compte.

## R4 — Exclusion mutuelle entre Membre et Abonné (FR-001, FR-006, FR-009)

- **Decision**:
  - Un membre (`findMembership(doc, wishlistId, userId) !== null`) qui tente de s'abonner reçoit `{ ok: false, error: "alreadyMember" }`.
  - Dans `acceptInvite` (`src/domain/membership.ts`), lorsque l'utilisateur rejoint une liste comme membre, toute entrée de `doc.subscriptions` pour `(wishlist.id, input.userId)` est supprimée dans la même opération.
- **Rationale**: Garantit l'invariant « aucun couple `(wishlistId, userId)` n'est présent à la fois dans `memberships` et dans `subscriptions` ».

## R5 — Confidentialité vis-à-vis des membres et nettoyage (FR-008, FR-010)

- **Decision**:
  - `toMemberListView` et `toListSummary` ne lisent jamais `doc.subscriptions`.
  - `exportAccount(doc, userId)` :
    - Dans `lists` (listes dont `userId` est membre) : aucune mention des abonnés.
    - Ajoute un champ `subscriptions: ExportedSubscription[]` listant uniquement les listes que `userId` suit lui-même (`{ title, subtitle, publicUrl, subscribedAt }`).
  - `wipeWishlist(doc, wishlistId)` supprime aussi `doc.subscriptions.filter((s) => s.wishlistId !== wishlistId)`.
  - `deleteAccount(doc, { userId })` supprime aussi `doc.subscriptions.filter((s) => s.userId !== userId)`.
- **Rationale**: Aucune fuite vers les membres (SC-003), aucune clé étrangère orpheline lors d'une suppression de liste ou de compte (SC-002, FR-010), et conformité RGPD pour l'export des données de l'abonné.

## R6 — Contrat API v1 (version `1.5.0`)

- **Decision**: Étendre `specs/004-mobile-api/contracts/openapi.yaml` de façon rétrocompatible :
  1. `GET /lists` : retourne `{ lists: ListSummary[], subscriptions: SubscribedListSummary[] }`.
     - `SubscribedListSummary` : `{ id, readToken, title, subtitle, coverImageUrl, theme, itemCount, readUrl, subscribedAt, locked }` (si `locked === true`, `itemCount` vaut `0` pour ne rien divulguer tant que le nouveau mot de passe n'est pas saisi).
  2. `POST /subscriptions` : `{ urlOrToken: string, password?: string }` → `201` (ou `200` si déjà abonné) avec `SubscribedListSummary`, `423` (`readPasswordRequired` avec `{ title, readToken }`) si protégée et non déverrouillée, `400` (`subscriptionLinkInvalid`, `alreadyMember`, `badPassword`), `404` (`listMissing`), `429` (`rateLimited`).
  3. `DELETE /subscriptions/{readToken}` : désabonne le compte connecté (`204`, `404` si non trouvée).
  4. `GET /public/lists/{readToken}`, `POST /public/lists/{readToken}/unlock`, `POST /public/lists/{readToken}/reservations` : déjà existants ! En outre, `unlockPublicList` met à jour `subscription.readPasswordHash` si l'appelant est connecté et déjà abonné à cette liste.
- **Rationale**:
  - Rétrocompatible pour `GET /lists` (ajout de la propriété `subscriptions` à côté de `lists`).
  - L'app mobile utilise déjà les routes `/public/lists/{readToken}/*` existantes du contrat 004 pour lire une liste suivie, la déverrouiller, réserver une idée et annuler sa propre réservation.

## R7 — Expérience dans l'app mobile et cache hors ligne

- **Decision**:
  - Sur `mobile/app/(app)/index.tsx` (« Mes listes ») :
    - Sous la section « Mes listes », afficher la section « Listes suivies » avec un bouton « Suivre une liste » qui ouvre un écran / formulaire permettant de coller un lien (et de saisir le mot de passe de lecture si requis, `423`).
    - Même quand l'utilisateur n'a aucune liste dont il est membre (`lists.length === 0`), la section « Listes suivies » est accessible.
  - Nouvel écran `mobile/app/(app)/shared/[readToken].tsx` :
    - Affiche la vue publique de la liste suivie (couverture, titre, sous-titre, filtres par « Pour qui ? » et « Budget » en pastilles, catégories en accordéon animé `@/ui/Accordion`, cartes d'idées publiques avec bouton « Réserver ce cadeau » / badge « Réservé par vous » + « Annuler la réservation », et bouton « Ne plus suivre » avec `ConfirmDialog`).
    - Si la liste répond `423 readPasswordRequired`, affiche le formulaire de mot de passe de lecture.
    - Stocke le dernier snapshot dans SQLite (`publicList:<readToken>`) pour permettre la lecture hors ligne (US2 scénario 4). Les actions d'écriture sur une liste suivie (réserver, annuler sa réservation, se désabonner) sont des actions en direct (désactivées hors ligne, comme la gestion des réservations membres).
- **Rationale**: Réutilise tous les composants existants de `mobile/src/ui/` (`Screen`, `Card`, `Accordion`, `PillTabs`, `Badge`, `Button`, `ConfirmDialog`, `Field`, `Input`, `Stars`, `ListCover`, `OfflineBanner`) sans aucun style en dur hors de `mobile/src/ui/`.
