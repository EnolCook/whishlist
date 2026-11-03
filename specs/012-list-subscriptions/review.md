# Revue de code

## Fichiers relus

```text
492e4d8690584c2782431c1c2650f1f4b43ed1e0  app/api/v1/capabilities/route.ts
d3689ded9f2523ffa0afb8b6401f07614927e42c  app/api/v1/lists/route.ts
c75af082081a4101c14e7099341f959d8c494254  app/api/v1/subscriptions/route.ts
8fcf54fa1d65c6423e48c942180af4038ceee4a4  app/api/v1/subscriptions/[readToken]/route.ts
bb237672b0851ef37da2908960d945467dd0c054  app/l/[readToken]/page.tsx
e6232276dd58a5b0530299068394577300c92c04  app/page.tsx
1eceba4bc4ff95bccd62e7db0996c910ad5b1341  components/site/read-unlock-form.tsx
611b6eedc6c0429c3d9e70a31742e34c15eefbeb  drizzle/0001_slim_dorian_gray.sql
4d701e36dcb0d90164330b77043fa9f5ba353379  locales/en/errors.json
244e8cd2e19f1cc93fb66d0e88f59311bd23449d  locales/en/home.json
73026476fc8a91d6833e794c4c66ac53abfa4a71  locales/en/mobile.json
918c238b6d4d821f0b0166334864204dc8f12a42  locales/en/public.json
7be89ed9621030d7504555682d1d4871bf2f9321  locales/fr/errors.json
fc102ee15e96cd1366711b9e27208d43768d7ae1  locales/fr/home.json
472a9e514fade3d7f2c9d795d0f93484ff26f7cd  locales/fr/mobile.json
0f00d393ae4306152dff12254bfb1cd0362d8530  locales/fr/public.json
18c042e60354c89aa1a69f03a8563defdd487297  mobile/.maestro/flows/012-us2-follow-and-browse.yaml
d7521279e575f9b2808665dfe2d8b14ddecd69a6  mobile/.maestro/flows/012-us3-unfollow.yaml
2775cc6e69a4c927eae1c3d7029561b4c9d21113  mobile/__tests__/api/schema.test.ts
fa67cd8f944a461a76c020ad62858bab4df984a3  mobile/__tests__/e2e/coverage.test.ts
5a22dc2f93ffdb959986d7ac5d4055b6899edf7e  mobile/__tests__/screens/shared-list.test.tsx
253f9d7a93c315a5495dd7107bd743a95807fb43  mobile/app/(app)/index.tsx
f1e999bd236d46bd4ec643af3063c25ad95bd435  mobile/app/(app)/shared/[readToken].tsx
e32f4609bef6f541406c200c133dd9eb0c088530  mobile/app/(app)/shared/follow.tsx
590bc6401025ecbd30048ed5c03291bb41faa219  mobile/src/api/client.ts
728fc9d61e9039a3f048a4e5089d051f019642d2  mobile/src/data/store.ts
0b5c21399e1afe91274a93a71abc08ddca4b3cba  mobile/src/data/subscriptions.ts
5518e4d2227ec343c8d1dc413501f19309fe51b6  mobile/src/offline/snapshot.ts
46ce878672f99092f8fd78a53ffafc82a4266fe8  mobile/src/ui/ConfirmDialog.tsx
7f8e881d8b639546d1a77301394d332114e1c623  scripts/create-demo-data.mjs
2b0a169e1548ea6c995cf9a5e0d3e98617dbb38d  specs/004-mobile-api/contracts/openapi.yaml
c07502f4b145f17218532397050b2c9ebfe0f502  src/auth/public-list.ts
9d4c951f393b0283881a9c5c176a7723751ceb1a  src/domain/account.ts
51744056f73163a123d07444a1e829ad5c8af5c0  src/domain/filters.ts
389ac5073e864f56e678a9f34632089578f28672  src/domain/membership.ts
9fe78a815f03c51a9a6a5c7c18027d7a2c32f043  src/domain/subscription.ts
dc3d2a28e35d1f85ecea294cd2c4b8b0a67ca036  src/domain/types.ts
0077e49869fbd901e8deb7aa9904a58c0ddfa39a  src/server/actions.ts
afc79bdba205ce697338d4f12ce281bd2032b872  src/server/api/views.ts
8a9f88fe0e3282829b7ffbcb0ff782e554d288eb  src/server/commands/lists.ts
9447791fcee9d85d821c05b972693831b6b48eec  src/server/commands/public-list.ts
ef6bdb85c2d650b8cc758421e25f4b13ca84fc03  src/store/legacy-json.ts
55edd0003cc820a6fa65dcdf90c63740a33ff17f  src/store/rows.ts
776a779bf957692367713bd79303c77d60f8433a  src/store/schema.ts
e7347b42c0f4908e2b9da1499a9955dc88a764c2  tests/domain/account-deletion.test.ts
71c28c5eeda859792f7f949dc0f5635bfac8c203  tests/domain/account-export.test.ts
3d101433a351e10cfad8f851412578b100bdbe2d  tests/domain/commands-subscription.test.ts
81372889e063b9b23421dc09d3b0e09d82eeee89  tests/domain/helpers/account-fixtures.ts
15b654d57d7f7e149043d1b59c2cdd86005b5e52  tests/domain/store-import.test.ts
cdd2333de0b37f6f53954639292ab41d35b1188c  tests/domain/subscription.test.ts
```

## Règles métier et tests

- [x] src/server/actions.ts:644 — Sur le site web, coller dans « Mes listes » le lien d'une liste protégée par mot de passe redirige vers `/l/[readToken]` sans abonner l'utilisateur une fois le mot de passe validé dans `unlockPublicListAction`, contrairement à US2 scénario 2, FR-002/FR-003 et `contracts/screens.md` § 1.2 (T019). Correction : transmettre l'intention d'abonnement lors de la redirection vers `/l/[readToken]` (et dans `ReadUnlockForm`) afin que `unlockPublicListAction` crée l'abonnement dès le mot de passe vérifié.
- [x] mobile/app/(app)/shared/[readToken].tsx:273 — Lorsqu'une liste suivie est verrouillée par un nouveau mot de passe de lecture (`locked === true`), l'écran mobile retourne uniquement le formulaire de déverrouillage sans afficher le bouton `shared.unfollow`, ce qui empêche de se désabonner d'une liste verrouillée dans l'app mobile (FR-004, US3 scénario 1, T028). Correction : rendre également le bouton « Ne plus suivre cette liste » (`shared.unfollow`) et son `ConfirmDialog` accessibles sur l'écran `shared.unlock-screen`.
- [x] mobile/app/(app)/shared/follow.tsx:80 — Lorsque `POST /api/v1/subscriptions` répond `423 readPasswordRequired` avec `{ title, readToken }`, `followList` (`mobile/src/data/subscriptions.ts:28`) ignore `title` et l'écran n'affiche pas le titre de la liste protégée, contrairement à `contracts/screens.md` § 2.2 et `contracts/api-v1-additions.md` § 2 (T020, T022). Correction : conserver `title` dans le retour `readPasswordRequired` de `followList` et l'afficher sur `mobile/app/(app)/shared/follow.tsx` lors de la demande du mot de passe.
- [x] src/server/api/views.ts:201 — `toSubscribedListSummary` calcule `itemCount` avec `listItems(doc, wishlist.id).length` (idées non archivées), ce qui exclut les idées réservées par l'abonné lui-même (archivées à la réservation) alors qu'elles font partie de sa vue publique selon FR-006 (T010). Correction : calculer `itemCount` à partir de `listPublicVisibleItems(doc, wishlist.id, mineReservationIdsFor(doc, wishlist.id, subscription.userId, new Set())).length` et l'éprouver dans `tests/domain/commands-subscription.test.ts`.
- [x] src/store/legacy-json.ts:144 — La rétrocompatibilité d'un fichier `wishlist.json` existant sans clé `subscriptions` (ainsi que la normalisation de `readPasswordHash` et les contrôles d'intégrité de `subscriptions` aux lignes 223–253, T006) n'est couverte par aucun test car `apiDoc()` fournit déjà `subscriptions: []`. Correction : supprimer `legacy.subscriptions` dans le test des valeurs par défaut de `tests/domain/store-import.test.ts` et y ajouter un cas de contrôle d'intégrité sur `subscriptions`.
- [x] tests/domain/commands-subscription.test.ts:212 — Il manque les tests des cas d'erreur de `unsubscribeFromList` (utilisateur non connecté `unauthorized`, `readToken` inconnu ou non suivi retournant `listMissing`) et du refus `mustChangePassword` sur `subscribeToList` / `unsubscribeFromList` (FR-001, FR-004, `contracts/api-v1-additions.md` § 2–3, T012). Correction : ajouter ces assertions de refus dans `tests/domain/commands-subscription.test.ts`.
- [x] mobile/__tests__/screens/shared-list.test.tsx:123 — Bien que T017 soit cochée (`[X]`), `mobile/__tests__/screens/shared-list.test.tsx` ne teste ni les filtres « Pour qui ? » et « Budget » (FR-007, US2 scénario 3), ni le déverrouillage d'une liste suivie verrouillée sur `SharedListScreen` (US2 scénario 2), ni l'affichage d'erreur pour un lien invalide ou une liste dont on est membre sur `FollowSharedList` (US2 scénario 5). Correction : compléter `mobile/__tests__/screens/shared-list.test.tsx` avec des tests couvrant ces trois scénarios.
- [x] specs/012-list-subscriptions/quickstart.md:45 — Le Parcours 2 de `quickstart.md` ne décrit ni la vérification manuelle de consultation hors ligne (US2 scénario 4, pourtant renvoyée vers cette section par `mobile/.maestro/exclusions.md:35`), ni le suivi d'une liste protégée par mot de passe de lecture et sa rotation (US2 scénario 2, FR-003). Correction : ajouter dans `specs/012-list-subscriptions/quickstart.md` les étapes de vérification manuelle pour la lecture hors ligne dans l'app mobile et pour une liste protégée par mot de passe de lecture.

## Constitution et sécurité

Aucun point.

## Duplication

- [x] mobile/src/data/subscriptions.ts:83 — `cancelSharedReservation` réimplémente à la main la vérification de réponse `204` et l'extraction du code d'erreur déjà fournies par `done` dans `mobile/src/api/client.ts:102`. Correction : appeler `await done(api.DELETE(...))` comme dans `unfollowList` (`mobile/src/data/subscriptions.ts:102`) et laisser le `catch (error)` existant gérer `ApiError`.
- [x] mobile/app/(app)/shared/[readToken].tsx:43 — Les identifiants de tranches de budget (`BUDGET_IDS`, `BudgetId`) et le prédicat `matchesBudget` recopient la logique déjà présente dans `src/domain/filters.ts:5-18` et `src/domain/filters.ts:69-76`. Correction : exporter et réutiliser `BUDGETS`, `BudgetId`, `parseBudget` ou `matchesBudget` depuis `src/domain/filters.ts` (module pur du domaine).
- [x] src/domain/subscription.ts:51 — `!wishlist.readPasswordHash` réimplémente la vérification de mot de passe de lecture déjà présente dans `src/domain/read-password.ts:14` (`hasReadPassword`). Correction : utiliser `!hasReadPassword(wishlist)` depuis `src/domain/read-password.ts`.
- [x] src/server/actions.ts:608 — Les trois actions `subscribeAction`, `subscribeByLinkAction` (`src/server/actions.ts:630`) et `unsubscribeAction` (`src/server/actions.ts:654`) répètent la vérification de session et de changement de mot de passe obligatoire déjà factorisée par `memberId()` dans `src/server/actions.ts:251`. Correction : réutiliser `await memberId()` dans `subscribeByLinkAction` et `unsubscribeAction` (et pour le contrôle `mustChangePassword` de `subscribeAction`).

## Conventions

- [x] app/l/[readToken]/page.tsx:263 — La redirection d'erreur de `subscribeAction` (`?e=...`) n'est ni lue ni traduite par `translateError` sur la page publique, alors que `AGENTS.md` (section « Conventions > i18n ») impose que toute chaîne d'erreur visible passe par `translateError` pour les codes d'erreur. Correction : Traduire `query.e` avec `translateError` (hors `badPassword` / `rateLimited` du formulaire de déverrouillage) et afficher l'alerte d'erreur correspondante sur la page publique.
- [x] mobile/app/(app)/shared/[readToken].tsx:46 — L'écran redéfinit les règles métier de filtrage par tranche de budget (`BUDGET_IDS`, `matchesBudget`) et de tri par priorité (`sortPublicItems`) au lieu d'être sans règle métier propre comme l'impose `AGENTS.md` (section « Conventions > Couches > mobile/ » : « app Expo, cliente de l'API, sans règle métier propre »). Correction : Importer et réutiliser les fonctions pures de filtrage et de tri depuis `src/domain/filters.ts`.
- [x] mobile/app/(app)/shared/[readToken].tsx:429 — L'écran écrit un style et une couleur en dur (`position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)"`) sur un `Modal` et un `Pressable` natifs, en violation de `AGENTS.md` (section « Conventions > Couches > mobile/ » : « Un écran n'écrit aucun style en dur : il compose les composants de `mobile/src/ui/` »). Correction : Extraire la boîte de dialogue modale dans un composant de `mobile/src/ui/` (ou `mobile/src/features/`) et l'utiliser dans l'écran.
- [x] mobile/src/data/subscriptions.ts:88 — L'annulation de réservation contourne `done(...)` et utilise un cast `error as { error?: { code?: string } } | undefined` pour lire le code d'erreur, contre la consigne de typage TypeScript strict (pas de cast pour faire taire le compilateur). Correction : Appeler `await done(api.DELETE(...))` comme dans `unfollowList` pour laisser `ApiError` porter `error.code` sans assertion de type.

## i18n

Aucun point.

## Deuxième revue (après rebase sur main, 2026-11-03)

- [x] src/server/commands/public-list.ts — Le mot de passe était vérifié contre la liste lue avant la transaction, mais l'abonnement mémorisait l'empreinte relue dans la transaction : un changement de mot de passe pendant la vérification donnait l'accès avec le nouveau mot de passe sans le connaître. `subscribeWishlist` et `syncSubscriptionUnlock` reçoivent l'empreinte vérifiée et refusent (`readPasswordChanged`) si elle a changé. Le résumé est construit dans la transaction (plus de relecture complète de la base), et `unlockPublicList` n'ouvre plus de transaction quand l'abonnement est déjà à jour.
- [x] src/server/actions.ts — Après un déverrouillage réussi, `subscribeToList` était hors du `try/catch` : une limite de débit menait à la page d'erreur de Next. Elle redirige maintenant vers la liste déverrouillée avec `?e=rateLimited`.
- [x] src/server/actions.ts — `subscribeAction` perdait l'intention de suivre quand le déverrouillage avait expiré, sans message. Redirection vers `?e=readPasswordRequired&subscribe=1` et message `public:unlock.passwordRequiredToFollow`.
- [x] mobile/src/data/subscriptions.ts — `unlockSharedList` jetait le `unlockToken` : une liste qu'on ne suit plus restait sur le formulaire après le bon mot de passe. Le jeton est gardé (même stockage que la vue invité) et envoyé en `X-Read-Unlock` à la lecture et à la réservation ; un 423 l'oublie.
- [x] mobile/app/(app)/shared/[readToken].tsx — Le bouton d'achat ouvrait toute adresse ; seuls les liens http(s) s'ouvrent (`webUrl` de la vue invité).
- [x] src/domain/account.ts — L'aperçu de suppression du compte ne citait pas les listes suivies. `followedLists` (API 1.7.0, facultatif) est affiché sur le site et dans l'app.
- [x] src/domain/subscription.ts — `extractReadToken` refusait des liens valides : sans schéma, schéma en majuscules, schéma de l'app, sous-pages de la liste.
- [x] mobile/src/data/subscriptions.ts — « Ne plus suivre » effaçait la copie SQLite mais pas celle en mémoire (`forgetPublicList`).

- [x] src/domain/filters.ts — À priorité égale, l'app triait par nom alors que le site garde l'ordre du propriétaire. `filterAndSortPublicItems` ne compare plus que la priorité (tri stable sur l'ordre rendu par l'API).
- [x] mobile/src/ui/ConfirmDialog.tsx — Sur iOS, le clavier couvrait le message et le bouton de la fenêtre de réservation. `ModalCard` remonte avec le clavier et défile ; le parcours Maestro 012-us2 saisit un message avant de confirmer.
- [x] Nettoyage : `followedListsOf` remplace quatre copies (accueil, `GET /lists`, export, aperçu de suppression), `viewerRelation` est partagé par la page publique et l'API, `POST /subscriptions` n'extrait plus le jeton deux fois, `subscribeToList` ne rend plus de champs que personne ne lit.

- [x] mobile/app/(app)/shared/[readToken].tsx — L'écran « liste suivie » refaisait la vue invité (lecture, déverrouillage, réservation, annulation, cartes, textes) et divergeait déjà d'elle ; un lien `/l/<token>` vers une liste suivie ouvrait la vue invité, sans « Ne plus suivre ». Un seul écran reste, la vue de la liste (`/guest/[readToken]`), qui gagne « Suivre / Ne plus suivre » (`GuestFollow`, d'après `subscribed` et `isMember`), les filtres « Pour qui ? » et budget, le tri par envie, et une copie hors ligne pour les listes suivies seulement. « Mes listes » et « Suivre une liste » y mènent ; la mécanique `publicList` du store et les textes `mobile:shared.*` de l'ancien écran sont retirés. Après une réservation, l'écran revient à la liste (relue au retour) au lieu de l'empiler une seconde fois.

Ajouté après la revue, à la demande : US4 (scanner le QR code d'une liste depuis « Suivre une liste »), spec, quickstart et tâches T033–T037.

Reste ouvert : un seul commit pour les trois stories (sans objet, la PR est squashée).
