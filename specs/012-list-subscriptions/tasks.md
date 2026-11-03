---
description: "Task list for feature 010 — s'abonner à des listes pour suivre leur contenu"
---

# Tasks: S'abonner à des listes pour suivre leur contenu

**Input**: Design documents from `specs/012-list-subscriptions/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-v1-additions.md](contracts/api-v1-additions.md), [contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md)

**Tests**: Inclus. `AGENTS.md` exige un test pour chaque règle métier et cas limite, ainsi qu'un parcours Maestro par user story de l'app mobile.

**Organization**: Tâches groupées par user story afin de livrer et tester chaque story de façon indépendante.

## Un commit par user story (règle du projet)

Chaque phase de user story se termine par une tâche **« Commit de la story »**, la dernière de la phase. Règles :

- Les phases Setup et Foundational n'ont pas de commit propre : elles entrent dans le commit de la première story.
- Chaque commit est vert (lint, types, tests). Un test existant à adapter va dans le commit de la story qui rend l'adaptation nécessaire.
- Un fichier modifié par deux stories est commité en deux temps (seulement les changements de la story en cours).
- La phase Polish a son propre commit (`chore:` ou `feat:` selon le contenu). Les corrections de la revue lancée par le hook `after_implement` forment un commit à part, `fix: corrections de la revue`, avec `review.md`.
- Message en anglais, préfixé `feat:`, `fix:` ou `chore:`, terminé par `(USn)`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallélisable (fichiers différents, pas de dépendance sur une tâche non finie)
- **[Story]**: Story concernée (`[US1]`, `[US2]`, `[US3]`)
- Chaque description indique les chemins exacts des fichiers concernés

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Clés de traduction FR/EN partagées entre le serveur, le site et l'application mobile.

- [X] T001 [P] Ajouter les codes d'erreur `"subscriptionLinkInvalid"` et `"alreadyMember"` dans `locales/fr/errors.json` et `locales/en/errors.json`
- [X] T002 [P] Ajouter les clés `"subscription"` (`follow`, `following`, `unfollow`, `unfollowTitle`, `unfollowBody`, `unfollowConfirm`, `unfollowKeep`, `followedToast`, `unfollowedToast`) dans `locales/fr/public.json` et `locales/en/public.json`
- [X] T003 [P] Ajouter les clés `"followed"` (`title`, `empty`, `linkLabel`, `linkPlaceholder`, `followSubmit`, `lockedBadge`, `unfollow`, `unfollowTitle`, `unfollowBody`, `unfollowConfirm`, `unfollowKeep`) dans `locales/fr/home.json` et `locales/en/home.json`
- [X] T004 [P] Ajouter les clés `"shared"` (`followButton`, `followTitle`, `followDescription`, `linkLabel`, `linkPlaceholder`, `passwordLabel`, `passwordHint`, `submitFollow`, `unlockTitle`, `unlockDescription`, `unlockSubmit`, `filterWho`, `everyone`, `filterBudget`, `allPrices`, `offerTitle`, `fromName`, `note`, `privacyHint`, `noPurchaseHint`, `confirmReserve`, `unfollow`, `unfollowTitle`, `unfollowBody`, `unfollowConfirm`, `unfollowKeep`) dans `locales/fr/mobile.json` et `locales/en/mobile.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modèle de données `Subscription`, table SQLite + migration Drizzle, règles pures du domaine, commandes serveur, contrat OpenAPI 1.5.0 et routes API v1.

**⚠️ CRITICAL**: Aucune user story ne peut commencer avant la fin de cette phase.

- [X] T005 Ajouter l'interface `Subscription` (`wishlistId: string`, `userId: string`, `readPasswordHash: string | null`, `createdAt: string`) et le champ `subscriptions: Subscription[]` dans `Database` et `emptyDatabase()` dans `src/domain/types.ts`
- [X] T006 Ajouter la table `subscriptions` (clé primaire composite `(wishlistId, userId)`, FK vers `wishlists.id` et `users.id`, `readPasswordHash` nullable, `createdAt` non null, index `subscriptions_user_id`) dans `src/store/schema.ts`, enregistrer la collection `subscriptions` dans `src/store/rows.ts`, l'ajouter à `OPTIONAL`, `FIELDS`, `normalizeDocument` et `checkDocument` dans `src/store/legacy-json.ts`, puis générer la migration SQL dans `drizzle/` via `npm run db:generate`
- [X] T007 Créer `src/domain/subscription.ts` avec les fonctions pures : `extractReadToken(raw: string): string | null` (URL `/l/<token>`, `/en/l/<token>` ou jeton brut `^[A-Za-z0-9_-]{8,128}$`), `findSubscription(doc, wishlistId, userId)`, `isSubscriptionUnlocked(wishlist, subscription)` (`wishlist.readPasswordHash === null || subscription.readPasswordHash === wishlist.readPasswordHash`), `subscribeWishlist(doc, { wishlistId, userId, now? })` (refuse `alreadyMember` si membre, `listMissing` si absente, `accountMissing` si utilisateur absent ; idempotent et met à jour `readPasswordHash = wishlist.readPasswordHash`), `syncSubscriptionUnlock(doc, { wishlistId, userId })` et `unsubscribeWishlist(doc, { wishlistId, userId })`
- [X] T008 Mettre à jour `src/domain/membership.ts` (`wipeWishlist` supprime les abonnements de la liste ; `acceptInvite` retire tout abonnement existant de `(wishlist.id, input.userId)`), `src/domain/account.ts` (`deleteAccount` supprime les abonnements du compte ; `exportAccount` inclut `subscriptions: { title, subtitle, publicUrl, subscribedAt }[]` sans jamais exposer les abonnés d'une liste à ses membres) et `src/auth/public-list.ts` (`canAccessPublicListWith` autorise un utilisateur connecté abonné dont `isSubscriptionUnlocked` est vrai)
- [X] T009 [P] Écrire les tests unitaires du domaine dans `tests/domain/subscription.test.ts` (extraction de jeton depuis URL/chemin/jeton brut, abonnement, idempotence, refus `alreadyMember`, refus liste/compte inexistant, déverrouillage et invalidation quand le mot de passe de lecture change, retrait automatique lors de `acceptInvite`) et compléter `tests/domain/account-deletion.test.ts` et `tests/domain/account-export.test.ts` pour couvrir `subscriptions`
- [X] T010 Mettre à jour `src/server/api/views.ts` (`SubscribedListSummaryView`, `toSubscribedListSummary` avec `locked: !isSubscriptionUnlocked(wishlist, sub)` et `itemCount: locked ? 0 : ...`, ajout de `subscribed: boolean` et `isMember: boolean` dans `PublicListView`), `src/server/commands/lists.ts` (`listMine` retourne `{ lists, subscriptions }`) et `src/server/commands/public-list.ts` (`subscribeToList`, `unsubscribeFromList`, mise à jour de `unlockPublicList` pour synchroniser `readPasswordHash` si abonné connecté, et `readPublicList`)
- [X] T011 Mettre à jour `specs/004-mobile-api/contracts/openapi.yaml` (version `1.5.0`, `GET /lists` avec `subscriptions`, `POST /subscriptions`, `DELETE /subscriptions/{readToken}`, `PublicList` avec `subscribed` et `isMember`, `SubscribedListSummary`, `AccountExport.subscriptions`), mettre à jour `app/api/v1/capabilities/route.ts` et `app/api/v1/lists/route.ts`, créer `app/api/v1/subscriptions/route.ts` et `app/api/v1/subscriptions/[readToken]/route.ts`, puis régénérer `mobile/src/api/schema.d.ts` avec `npm --prefix mobile run api:types`
- [X] T012 Écrire les tests des commandes et de l'API dans `tests/domain/commands-subscription.test.ts` (abonnement par lien/jeton, liste protégée avec/sans déverrouillage ou mot de passe, rotation du mot de passe de lecture qui verrouille la liste suivie jusqu'au nouveau déverrouillage, désabonnement qui préserve les réservations, isolation vis-à-vis des membres, limite de débit)

**Checkpoint**: Socle domaine, SQLite, commandes et API v1 (`1.3.0`) opérationnels et testés.

---

## Phase 3: User Story 1 - S'abonner depuis une liste publique sur le site et la retrouver dans « Mes listes » (Priority: P1) 🎯 MVP

**Goal**: Sur le site web, permettre de s'abonner en 1 clic depuis `/l/[readToken]` (ou après connexion si invité) et afficher la section « Listes suivies » dans « Mes listes » (`/`).

**Independent Test**: [quickstart.md § Parcours 1](quickstart.md#parcours-1--sabonner-depuis-la-page-publique-sur-le-site-us1).

### Implementation for User Story 1

- [X] T013 [US1] Ajouter `subscribeAction` dans `src/server/actions.ts` (redirige vers `/connexion?next=/l/<readToken>` si non connecté, appelle `subscribeToList` avec `hasReadUnlock`, redirige vers `/l/<readToken>?followed=1`)
- [X] T014 [US1] Mettre à jour `app/l/[readToken]/page.tsx` pour afficher le bouton « Suivre cette liste » (lien vers `/connexion?next=...` si invité, formulaire `subscribeAction` si connecté non membre et non abonné, badge « Liste suivie » si déjà abonné, masqué si membre de la liste)
- [X] T015 [US1] Mettre à jour `app/page.tsx` pour afficher la section « Listes suivies » sous « Mes listes » (y compris lorsque l'utilisateur n'est membre d'aucune liste), avec couverture, titre pointant vers `/l/[readToken]`, sous-titre et badge si verrouillée par un nouveau mot de passe de lecture
- [X] T016 [US1] Commit de la story : `npm run lint`, `npm run typecheck`, `npm test`, `npm --prefix mobile run lint`, `npm --prefix mobile run typecheck` et `npm --prefix mobile test` verts, puis proposer le commit `feat: subscribe to a public list from the web and list followed wishlists (US1)` des fichiers de T001–T015 ; attendre l'accord avant de le créer

**Checkpoint**: User Story 1 fonctionnelle et testable indépendamment sur le site.

---

## Phase 4: User Story 2 - Suivre et consulter une liste partagée depuis l'espace « Mes listes » (App mobile et Site) (Priority: P2)

**Goal**: Permettre de suivre une liste en collant son lien depuis « Mes listes » (sur le site et dans l'app mobile), et consulter/filtrer/réserver sur une liste suivie dans l'app mobile (avec cache SQLite hors ligne en lecture).

**Independent Test**: [quickstart.md § Parcours 2](quickstart.md#parcours-2--suivre-par-lien-et-consulter-dans-lapp-mobile-us2) ; parcours Maestro `012-us2`.

### Tests for User Story 2

- [X] T017 [P] [US2] Écrire les tests d'écrans mobiles dans `mobile/__tests__/screens/shared-list.test.tsx` (affichage des listes suivies sur « Mes listes », ajout d'une liste suivie par lien avec et sans demande de mot de passe `423`, consultation des catégories et filtres, réservation d'une idée et annulation de sa propre réservation, lecture hors ligne depuis le snapshot SQLite)
- [X] T018 [P] [US2] Ajouter `"010": "specs/012-list-subscriptions/spec.md"` dans `mobile/__tests__/e2e/coverage.test.ts`, ajouter les exclusions pertinentes (US1 web uniquement ; US3 provisoire jusqu'à la Phase 5) dans `mobile/.maestro/exclusions.md`, et écrire le parcours `mobile/.maestro/flows/012-us2-follow-and-browse.yaml` (tag `012-us2`)

### Implementation for User Story 2

- [X] T019 [US2] Ajouter `subscribeByLinkAction` dans `src/server/actions.ts` et ajouter le formulaire d'ajout par lien (« Suivre une liste ») dans la section « Listes suivies » de `app/page.tsx` (avec redirection vers `/l/[readToken]` si la liste demande un mot de passe de lecture)
- [X] T020 [US2] Mettre à jour `mobile/src/offline/snapshot.ts` (`subscriptionsKey = "subscriptions"`, `publicListKey = (readToken: string) => "publicList:" + readToken`), `mobile/src/data/store.ts` (chargement et rafraîchissement de `subscriptions` dans `useMyLists`, hook `useSharedList(readToken)` avec snapshot SQLite hors ligne) et créer `mobile/src/data/subscriptions.ts` (`followList`, `unlockSharedList`, `reserveSharedItem`, `cancelSharedReservation`)
- [X] T021 [US2] Mettre à jour `mobile/app/(app)/index.tsx` pour afficher la section « Listes suivies » (`testID="lists.subscriptions-section"`), le bouton « Suivre une liste » (`testID="lists.follow-open"`) et les cartes des listes suivies (`testID="lists.shared-card-<readToken>"`)
- [X] T022 [US2] Créer l'écran `mobile/app/(app)/shared/follow.tsx` permettant de coller un lien ou jeton (`testID="follow.link"`), de saisir le mot de passe de lecture si l'API répond `423` (`testID="follow.password"`) et de valider (`testID="follow.submit"`)
- [X] T023 [US2] Créer l'écran `mobile/app/(app)/shared/[readToken].tsx` affichant la liste suivie : déverrouillage si `423`, filtres « Pour qui ? » et « Budget », catégories en accordéon animé (`@/ui/Accordion`), cartes d'idées publiques (lien externe, réservation avec nom/note, annulation de sa propre réservation avec `ConfirmDialog`)
- [X] T024 [US2] Commit de la story : `npm run lint`, `npm run typecheck`, `npm test`, `npm --prefix mobile run lint`, `npm --prefix mobile run typecheck` et `npm --prefix mobile test` verts, puis proposer le commit `feat: follow a list by link and browse shared lists in the mobile app (US2)` ; attendre l'accord avant de le créer

**Checkpoint**: User Stories 1 et 2 fonctionnelles sur le site et dans l'app mobile.

---

## Phase 5: User Story 3 - Se désabonner d'une liste suivie (Priority: P3)

**Goal**: Permettre de ne plus suivre une liste depuis la page de la liste ou depuis « Mes listes », sur le site et dans l'app mobile, tout en conservant ses réservations.

**Independent Test**: [quickstart.md § Parcours 3](quickstart.md#parcours-3--se-désabonner-sans-perdre-ses-réservations-us3) ; parcours Maestro `012-us3`.

### Tests for User Story 3

- [X] T025 [P] [US3] Compléter `mobile/__tests__/screens/shared-list.test.tsx` pour tester le désabonnement avec `ConfirmDialog` depuis l'écran d'une liste suivie et le retrait de la liste de « Mes listes »
- [X] T026 [P] [US3] Retirer l'exclusion provisoire de `012-us3` dans `mobile/.maestro/exclusions.md` et écrire `mobile/.maestro/flows/012-us3-unfollow.yaml` (tag `012-us3`)

### Implementation for User Story 3

- [X] T027 [US3] Ajouter `unsubscribeAction` dans `src/server/actions.ts` et brancher le bouton « Ne plus suivre » (avec `ConfirmForm`) sur `app/l/[readToken]/page.tsx` et sur les cartes de la section « Listes suivies » de `app/page.tsx`
- [X] T028 [US3] Ajouter `unfollowList(readToken)` dans `mobile/src/data/subscriptions.ts` (supprime l'abonnement côté serveur, nettoie le snapshot `publicList:<readToken>` et rafraîchit `subscriptions`) et ajouter le bouton « Ne plus suivre cette liste » (`testID="shared.unfollow"`) avec `ConfirmDialog` (`testID="shared.unfollow-confirm"`) dans `mobile/app/(app)/shared/[readToken].tsx`
- [X] T029 [US3] Commit de la story : `npm run lint`, `npm run typecheck`, `npm test`, `npm --prefix mobile run lint`, `npm --prefix mobile run typecheck` et `npm --prefix mobile test` verts, puis proposer le commit `feat: unfollow a subscribed wishlist on web and mobile (US3)` ; attendre l'accord avant de le créer

**Checkpoint**: Les 3 user stories sont complètes et testées.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Alignement de la documentation, vérification complète des tests sur toutes les plateformes et revue de feature.

- [X] T030 [P] Corriger dans `mobile/__tests__/api/schema.test.ts` l'appel à `openapi-typescript` pour qu'il fonctionne aussi sous Windows (invocation via `process.execPath` sur le script JS d'`openapi-typescript` au lieu du binaire shell `.bin/openapi-typescript`)
- [X] T031 Vérifier l'ensemble des suites (`npm run lint`, `npm run typecheck`, `npm test`, `npm --prefix mobile run lint`, `npm --prefix mobile run typecheck`, `npm --prefix mobile test`) et dérouler [quickstart.md](quickstart.md)
- [X] T032 Commit Polish : proposer le commit `chore: polish list subscriptions and cross-platform schema test` ; attendre l'accord avant de le créer

---

## Phase 7: User Story 4 - Suivre une liste en scannant son QR code (App mobile) (Priority: P3)

**Goal**: Depuis « Suivre une liste », scanner le QR code du lien public d'une liste (écran « Partager » d'un proche) au lieu de coller le lien.

**Independent Test**: [quickstart.md § Parcours 4](quickstart.md#parcours-4--suivre-une-liste-en-scannant-son-qr-code-us4) ; exclu de Maestro (pas de caméra dans le simulateur), couvert par un test d'écran avec caméra simulée.

### Tests for User Story 4

- [X] T033 [P] [US4] Dans `mobile/__tests__/screens/followed-lists.test.tsx`, avec `expo-camera` simulé : un QR code de liste suit la liste et ouvre sa vue ; un QR code étranger affiche « Ce QR code n'est pas le lien d'une liste » sans appel au serveur ; une liste protégée demande son mot de passe ; caméra refusée → message et lien vers les réglages
- [X] T034 [P] [US4] Ajouter la ligne `012-us4` dans `mobile/.maestro/exclusions.md` (caméra absente du simulateur, renvoi au Parcours 4)

### Implementation for User Story 4

- [X] T035 [US4] Ajouter `expo-camera` (`npx expo install`), son plugin dans `mobile/app.config.ts` (texte `NSCameraUsageDescription` traduit par langue, sans micro) et la permission Android `CAMERA` ; régénérer les licences (`npm --prefix mobile run licenses`)
- [X] T036 [US4] Ajouter le bouton « Scanner un QR code » et la vue caméra (`CameraView`, codes QR seulement) sur `mobile/app/(app)/shared/follow.tsx` : `extractReadToken` (`src/domain/subscription.ts`) filtre le contenu scanné, puis même suivi qu'un lien collé ; textes `mobile:shared.scan*` en FR/EN
- [X] T037 [US4] Commit de la story : lint, types et tests (site et app) verts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** : Aucune dépendance — T001 à T004 peuvent s'exécuter en parallèle.
- **Foundational (Phase 2)** : Dépend de Phase 1 — bloque toutes les user stories.
- **User Story 1 (Phase 3)** : Dépend de Phase 2 — livre le MVP sur le site web.
- **User Story 2 (Phase 4)** : Dépend de Phase 2 (et s'intègre à `app/page.tsx` modifié en US1).
- **User Story 3 (Phase 5)** : Dépend de US1 et US2 (ajoute l'action de désabonnement aux écrans créés).
- **Polish (Phase 6)** : Après US3, suivi du hook `wishlist.feature-review`.

### Parallel Opportunities

- Phase 1 : T001, T002, T003, T004 en parallèle (fichiers i18n distincts).
- Phase 2 : T009 en parallèle de T010 après T008.
- Phase 4 : T017 et T018 en parallèle avant T020–T023.
- Phase 5 : T025 et T026 en parallèle avant T027–T028.

---

## Parallel Example: User Story 2

```bash
Task: "Écrire les tests d'écrans mobiles dans mobile/__tests__/screens/shared-list.test.tsx"
Task: "Écrire le parcours Maestro mobile/.maestro/flows/012-us2-follow-and-browse.yaml"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Compléter Phase 1 (Setup i18n) + Phase 2 (Domaine, SQLite, Commandes, API v1.5.0).
2. Compléter Phase 3 (US1 : s'abonner depuis `/l/[readToken]` et voir « Listes suivies » sur `/`).
3. Valider et commiter US1.

### Incremental Delivery

1. Setup + Foundational + US1 → 1er commit (`feat: ... (US1)`).
2. US2 (ajout par lien site + app mobile + consultation/réservation mobile) → 2e commit (`feat: ... (US2)`).
3. US3 (désabonnement site + app mobile) → 3e commit (`feat: ... (US3)`).
4. Polish → 4e commit, puis lancement automatique de `wishlist-feature-review`.
