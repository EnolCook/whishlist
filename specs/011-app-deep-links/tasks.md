---

description: "Tâches de la feature 011 : liens qui ouvrent l'app, icône de l'app sur le site, vue invité"
---

# Tasks: Liens qui ouvrent l'app

**Input**: documents de `specs/011-app-deep-links/` ([plan](./plan.md), [spec](./spec.md), [research](./research.md), [data-model](./data-model.md), [contrat des liens](./contracts/links.md), [contrat de l'API](./contracts/api.md), [quickstart](./quickstart.md))

**Tests**: inclus. AGENTS.md demande un test de domaine pour chaque règle métier et chaque cas limite, et un parcours e2e (ou une exclusion) pour chaque story de l'app.

**Organization**: tâches groupées par user story. Le site, l'API et l'app mobile sont concernés. US1, US2 et US4 reposent sur la fondation (table des liens, `+native-intent`). US3 (site) n'en dépend pas.

**Points à confirmer avant de commencer** :

- Les badges officiels des stores sont à télécharger depuis les pages marketing d'Apple et de Google (T037).
- Le build natif 1.1.0 et sa soumission aux stores restent hors de ces tâches : ils se lancent à la main, comme pour la 1.0.0.

## Un commit par user story (règle du projet)

Chaque phase de user story se termine par une tâche **« Commit de la story »**, la dernière de la phase. Règles :

- Les phases Setup et Foundational n'ont pas de commit propre : elles entrent dans le commit de la première story.
- Chaque commit est vert (lint, types, tests). Un test existant à adapter va dans le commit de la story qui rend l'adaptation nécessaire.
- Un fichier modifié par deux stories est commité en deux temps (seulement les changements de la story en cours).
- La phase Polish a son propre commit (`chore:` ou `feat:` selon le contenu). Les corrections de la revue lancée par le hook `after_implement` forment un commit à part, `fix: corrections de la revue`, avec `review.md`.
- Message en anglais, préfixé `feat:`, `fix:` ou `chore:`, terminé par `(USn)`.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : peut se faire en parallèle (fichiers différents, sans dépendance à une tâche inachevée)
- **[Story]** : US1, US2, US3 ou US4 (spec.md)

---

## Phase 1: Setup

**Purpose**: rien à installer (aucune nouvelle dépendance). Vérifier le point de départ et lire la doc des versions en place.

- [X] T001 Vérifier que `npm run lint`, `npm run typecheck`, `npm test` et `npm --prefix mobile run lint|typecheck|test` sont verts avant tout changement. Lire ensuite :
  - dans `node_modules/next/dist/docs/` : les route handlers (dont le passage sur `.well-known` de `01-app/02-guides/backend-for-frontend.md`) et `03-file-conventions/proxy.md` (`matcher`) ;
  - dans `mobile/node_modules/expo-router/build/types.d.ts` : `NativeIntent.redirectSystemPath` ;
  - la doc Expo de `ios.associatedDomains` et `android.intentFilters` (types de `mobile/node_modules/@expo/config-types`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: table des liens partagée, fichiers d'association, réception dans l'app, lien en attente, version du contrat et outils Maestro. US1, US2 et US4 en dépendent.

**⚠️ CRITICAL**: aucune story de l'app (US1, US2, US4) ne commence avant la fin de cette phase. US3 peut commencer tout de suite.

- [X] T002 Créer `src/site/app-links.ts`, module pur sans import de Next ni de Node, repris par l'app comme `src/site/contact.ts`.
  - `APP_LINK_ROUTES` : la table de [contracts/links.md](./contracts/links.md), avec pour chaque ligne `sitePattern` (par exemple `/confirmer-email/:token`), `appPath(params, query)` et `keepQuery` (`suite`, `next`, `itemId`, `typeId`).
  - `APP_BUNDLE_ID = "app.ohyoushouldnt.mobile"`.
  - `appPathForSiteUrl(url, { apiHost, scheme })` → `string | null`. Elle accepte trois formes : `https://<apiHost>/…`, `ohyoushouldnt://…` (l'hôte est le premier segment) et un chemin seul. Elle retire le préfixe `/en`. Elle rend `null` pour un autre hôte, un chemin non listé, un segment vide ou un `:param` qui contient `/`. Elle décode chaque segment une fois.
  - `appleAssociation(teamId)` et `androidAssociation(fingerprints)` : les JSON de [links.md](./contracts/links.md). `components` contient chaque chemin avec et sans `/en`. Une empreinte hors du format `([0-9A-F]{2}:){31}[0-9A-F]{2}` est ignorée.
  - `androidPathPrefixes()` : les préfixes des `intentFilters`, avec et sans `/en`.
- [X] T003 [P] Créer `tests/domain/app-links.test.ts`. Il couvre :
  - chaque ligne de la table, en `/x` et en `/en/x` ;
  - les trois formes d'adresse ;
  - la requête gardée ou ignorée ;
  - `null` pour `/guide`, `/compte/export`, `/api/v1/me`, un autre hôte, `/inviter/` (segment vide) et `/inviter/a%2Fb` ;
  - `appleAssociation` : les `appIDs` et le nombre de `components` ;
  - `androidAssociation`, quand une empreinte est invalide.
- [X] T004 Créer les deux route handlers :
  - `app/.well-known/apple-app-site-association/route.ts` ;
  - `app/.well-known/assetlinks.json/route.ts`.

  Ils lisent `APPLE_TEAM_ID` (10 caractères `[A-Z0-9]`) et `ANDROID_CERT_SHA256` (empreintes séparées par des virgules) par deux fonctions de `src/site/app-links-config.ts`. Ils répondent `200` en `application/json` avec `cache-control: public, max-age=3600`, ou `404` sans valeur valide. Ajouter `\.well-known/` aux exclusions du `matcher` de `proxy.ts`. Documenter les deux variables dans le tableau du `README.md`, dans `.env.example` et dans `deploy/compose.prod.yml` (`WHISHLIST_APPLE_TEAM_ID`, `WHISHLIST_ANDROID_CERT_SHA256`, vides par défaut). Tests dans `tests/domain/app-links.test.ts` : appel des `GET` exportés, avec et sans variable, pour le statut, l'en-tête et le corps.
- [X] T005 [P] Dans `mobile/app.config.ts` :
  - `version: "1.1.0"` ;
  - si `apiUrl` commence par `https://` et que la variante n'est pas `development`, `ios.associatedDomains: ["applinks:<hôte>"]` et `android.intentFilters` (une entrée `autoVerify: true`, `action: "VIEW"`, `category: ["BROWSABLE", "DEFAULT"]`, un `data` `{ scheme: "https", host, pathPrefix }` par préfixe de `androidPathPrefixes()`, importé de `../src/site/app-links`).

  Test `mobile/__tests__/links/app-config.test.ts` : en `https`, chaque préfixe est déclaré et le domaine est associé. En `http` et en variante `development`, rien n'est déclaré.
- [X] T006 Créer `mobile/src/links/routes.ts`. Il ré-exporte `appPathForSiteUrl` avec l'hôte de `EXPO_PUBLIC_API_URL` et le schéma `ohyoushouldnt`. Créer aussi `mobile/app/+native-intent.tsx` : `redirectSystemPath({ path })` rend `appPathForSiteUrl(path) ?? "/"`, dans un `try/catch` qui rend `"/"`, et n'écrit pas l'adresse dans la console (R12). Test `mobile/__tests__/links/native-intent.test.ts` : un lien web, un lien au schéma, un chemin inconnu, une adresse mal formée qui ne lève rien.
- [X] T007 Créer `mobile/src/links/pending.ts` : `setPendingLink(path)`, `takePendingLink()` (lit puis vide), en mémoire, et le dernier lien gagne (data-model, « Lien en attente »). Dans `mobile/app/(auth)/_layout.tsx` et `mobile/app/change-password.tsx`, une fois la session `signedIn`, rediriger vers `takePendingLink() ?? "/"`. Tests dans `mobile/__tests__/links/pending.test.ts` et dans le test d'écran existant de la connexion, avec un lien en attente.
- [X] T008 Dans `specs/004-mobile-api/contracts/openapi.yaml` :
  - `info.version: "1.4.0"`, avec sa note ;
  - un paragraphe « Liens de l'app » dans `info.description`, qui renvoie à `specs/011-app-deep-links/contracts/links.md` ;
  - dans les descriptions de `/auth/password-reset`, `/me/email-verification` et `/me/email`, « Le lien ouvre le site » devient « Le lien envoyé ouvre l'app si elle est installée, le site sinon ».

  Les routes elles-mêmes arrivent avec leur story (T014, T026), pour que `tests/domain/api-contract.test.ts` reste vert à chaque commit.
- [X] T009 [P] Outils Maestro :
  - `mobile/.maestro/scripts/maildev-link.js` prend un paramètre `KIND` (`confirmer-email` par défaut, `reinitialiser`, `inviter`) qui choisit le chemin cherché, et rend `output.link` en plus de `output.confirmUrl` (gardé pour les parcours de la 010) ;
  - nouveau `mobile/.maestro/scripts/app-link.js` : `URL` → `output.appLink`, l'adresse au schéma `ohyoushouldnt://<chemin>?<requête>` ;
  - documenter les deux scripts dans `mobile/.maestro/README.md`.

**Checkpoint**: le site sert les fichiers d'association quand les variables sont réglées. Un lien `ohyoushouldnt://…` ouvert sur le simulateur arrive sur le chemin de l'app prévu (l'écran n'existe pas encore : `+not-found`).

---

## Phase 3: User Story 1 - Les liens des e-mails de compte ouvrent l'app (Priority: P1) 🎯 MVP

**Goal**: confirmation d'adresse, réinitialisation du mot de passe, changement d'adresse et lien de connexion s'ouvrent dans l'app et y font l'action.

**Independent Test**: [quickstart US1](./quickstart.md#us1--liens-des-e-mails-de-compte) et le parcours Maestro `011-us1`.

### Tests for User Story 1

- [X] T010 [P] [US1] Dans `tests/domain/commands-auth.test.ts`, tests de `resetPasswordWithLink`, sur une base temporaire (`withStore`) :
  - lien valide : mot de passe changé, adresse vérifiée, `sessionVersion` incrémentée ;
  - avec `signIn: true`, une session rendue ; avec `signIn: false`, `session: null` ;
  - `passwordTooShort`, `resetLinkInvalid` (inconnu, déjà utilisé) et `resetLinkExpired` ;
  - la 21e tentative en 15 min depuis la même IP est refusée (limite `password-reset-confirm`).
- [X] T011 [P] [US1] Dans `tests/domain/api-http.test.ts`, tests des deux routes :
  - `POST /api/v1/auth/email-confirmation` : `200` `{ purpose, ownAccount, suite }`, avec et sans bearer ; `400` `confirmationLinkInvalid` ; `400` `confirmationLinkExpired` ; `suite` externe (`https://…`) rendue `null` ;
  - `POST /api/v1/auth/password-reset/confirm` : `200` avec ou sans session selon `signIn` ; `400` `passwordTooShort` ; `400` `resetLinkInvalid` ; `429`.

### Implementation for User Story 1

- [X] T012 [US1] Dans `src/server/commands/auth.ts`, créer `resetPasswordWithLink(ctx, { token, password, signIn })`. Elle reprend la logique de `resetPasswordAction` (`resetPasswordWithToken` dans `updateDocument`) et appelle `rateLimitForIp("password-reset-confirm", ctx.ip, 20, 15 * 60 * 1000)`. Avec `signIn`, elle ouvre une session API par `openApiSession`. Elle rend `{ ok: true, userId, sessionVersion, session: SessionView | null }`. Dans `src/server/actions.ts`, `resetPasswordAction` l'appelle avec `signIn: false`, garde `openSession` pour le cookie du site, et redirige en `?e=rate` sur une erreur de débit. Dans `app/reinitialiser/[token]/page.tsx`, afficher `e=rate` avec le texte de limite existant (`translateError`).
- [X] T013 [US1] Créer les deux routes, sur le modèle de `app/api/v1/auth/login/route.ts` (`withApi`, corps JSON, commande, `apiJson` / `apiError`) :
  - `app/api/v1/auth/email-confirmation/route.ts` : `POST`, bearer optionnel pour `ownAccount`, commande `confirmEmailWithToken` existante ;
  - `app/api/v1/auth/password-reset/confirm/route.ts` : `POST`, sans bearer, commande `resetPasswordWithLink`.

  Ajouter à `src/server/api/errors.ts` `resetLinkInvalid`, `resetLinkExpired`, `confirmationLinkInvalid` et `confirmationLinkExpired` en `400` s'ils n'y sont pas. Les corps ne sont pas journalisés (FR-009).
- [X] T014 [US1] Reporter dans `specs/004-mobile-api/contracts/openapi.yaml` les deux opérations de [contracts/api.md](./contracts/api.md) (« Depuis 1.4.0 »), puis lancer `npm --prefix mobile run api:types`. `tests/domain/api-contract.test.ts` doit rester vert.
- [X] T015 [P] [US1] Ajouter les textes `links.confirmEmail.*` (en cours, adresse confirmée, adresse changée, lien plus valide, réessayer) et `links.resetPassword.*` (titre, champ, règle, enregistré) dans `locales/fr/mobile.json` et `locales/en/mobile.json`, avec les mêmes clés et en vouvoyant en français. Réutiliser les textes du site du namespace `auth` (`confirmEmail.*`, `reset.*`) quand ils disent la même chose. Les erreurs passent par les codes de `errors.json`.
- [X] T016 [US1] Créer `mobile/app/links/confirm-email/[token].tsx`.
  - À l'ouverture, `POST /auth/email-confirmation` avec `{ token, suite }`, puis `refreshMe()` si une session est ouverte.
  - Après une validation (`verify`) : « adresse confirmée » et un bouton vers ses listes, ou vers la connexion sans session. Après un changement (`change`) : « Mon compte » si `ownAccount`, sinon la connexion.
  - En erreur : le message du code, plus « Renvoyer le lien » (`VerificationBanner`) si le compte connecté n'est pas vérifié.
  - Hors ligne : l'erreur réseau habituelle et « Réessayer ».
  - L'écran n'affiche jamais l'adresse.
  - Composer les composants de `mobile/src/ui/`, sans style en dur. `testID` : `confirm-email.screen`, `confirm-email.status`, `confirm-email.error`, `confirm-email.next`, `confirm-email.retry`.
- [X] T017 [US1] Créer `mobile/app/links/reset-password/[token].tsx`.
  - Le formulaire reprend le champ unique de la page du site. La règle de longueur est vérifiée par le serveur, comme dans les autres formulaires de l'app : `src/domain/passwords.ts` importe `node:crypto` et ne peut pas être repris.
  - L'envoi fait `POST /auth/password-reset/confirm` avec `signIn` = `getSession().status === "signedOut"`. Une session rendue est passée à `signIn(session)`, puis l'écran ouvre `/`. Sans session rendue, il affiche « mot de passe enregistré » et un bouton vers la connexion.
  - Les erreurs sont celles du site : lien plus valide, avec un lien vers `/forgot-password`, et limite de débit.
  - `testID` : `reset-password.screen`, `reset-password.password`, `reset-password.submit`, `reset-password.error`, `reset-password.new-link`, `reset-password.done`.
- [X] T018 [P] [US1] Tests d'écran :
  - `mobile/__tests__/screens/links-confirm-email.test.tsx` : succès connecté (le bandeau disparaît après `refreshMe`), succès sans session, changement d'adresse, lien expiré, hors ligne ;
  - `mobile/__tests__/screens/links-reset-password.test.tsx` : mot de passe trop court refusé par le serveur, succès sans session (connexion automatique), succès avec une autre session (session gardée), lien invalide.

  Les deux s'appuient sur le faux `fetch` de `__tests__/helpers/fetch.ts`.
- [X] T019 [US1] Créer le parcours Maestro `mobile/.maestro/flows/011-us1-email-links.yaml` (tag `011-us1`). Il :
  - inscrit un compte (`subflows/register-unconfirmed.yaml`) ;
  - lit le lien de confirmation (`maildev-link.js`), le convertit (`app-link.js`) et l'ouvre par `openLink` ;
  - vérifie `confirmEmail.status`, puis l'absence de `verify.banner` ;
  - se déconnecte, demande « mot de passe oublié », ouvre le lien `reinitialiser` par le schéma, saisit un nouveau mot de passe et vérifie l'arrivée sur les listes ;
  - ouvre `ohyoushouldnt://connexion` connecté et vérifie les listes.

  `npm --prefix mobile test` doit valider les `id:` (`__tests__/e2e/test-ids.test.ts`) et la couverture.
- [ ] T020 [US1] (à jouer à la main, choix du 2026-11-02) Jouer le parcours [quickstart US1](./quickstart.md#us1--liens-des-e-mails-de-compte) sur le simulateur de référence (iPhone 17 Pro Max), et `npm --prefix mobile run e2e -- .maestro/flows/011-us1-email-links.yaml`. Noter dans `quickstart.md` ce qui diverge.
- [X] T021 [US1] Commit de la story : `npm run lint`, `npm run typecheck`, `npm test` et `npm --prefix mobile run lint|typecheck|test` verts. Créer ensuite le commit `feat: open account email links in the app (US1)`, sans demander.

**Checkpoint**: les liens de compte s'ouvrent dans l'app par le schéma. Sur la production, ils s'ouvriront par le domaine une fois les variables réglées et le build 1.1.0 installé.

---

## Phase 4: User Story 2 - Le lien d'invitation fait rejoindre la liste dans l'app (Priority: P2)

**Goal**: le lien d'invitation présente la liste dans l'app, fait passer par la connexion si besoin, puis fait rejoindre la liste.

**Independent Test**: [quickstart US2](./quickstart.md#us2--invitation) et le parcours Maestro `011-us2`.

### Tests for User Story 2

- [X] T022 [P] [US2] Dans `tests/domain/commands-sharing.test.ts`, tests de `previewInvite` :
  - lien valide pour un compte non membre : `{ title, listId: null }` ;
  - compte déjà membre : `listId` rempli ;
  - lien régénéré, ou inconnu : `inviteLinkBroken` ;
  - sans compte : refus ;
  - `mustChangePassword` : refus, comme les autres commandes ;
  - aucune écriture dans la base.
- [X] T023 [P] [US2] Dans `tests/domain/api-http.test.ts`, `GET /api/v1/invitations/{inviteToken}` : `200`, `401` sans bearer, `404` `inviteLinkBroken`.

### Implementation for User Story 2

- [X] T024 [US2] Dans `src/server/commands/sharing.ts`, créer `previewInvite(ctx, { token })`. Elle vérifie le compte par `activeUser(ctx)`, sans exiger une adresse vérifiée (seul `accept` l'exige). Elle cherche la liste par `inviteToken` dans `readDocument()` et rend `{ ok: true, title, listId }`, où `listId` n'est rempli que si `findMembership` trouve le compte. Sinon elle rend `{ ok: false, error: "inviteLinkBroken" }`.
- [X] T025 [US2] Créer `app/api/v1/invitations/[inviteToken]/route.ts` (`GET`, bearer exigé, `withApi` → `previewInvite` → `apiJson`). La route `accept/route.ts` existante ne change pas.
- [X] T026 [US2] Reporter `GET /invitations/{inviteToken}` dans `specs/004-mobile-api/contracts/openapi.yaml` ([contracts/api.md](./contracts/api.md)), puis lancer `npm --prefix mobile run api:types`.
- [X] T027 [P] [US2] Ajouter les textes `links.invite.*` (titre « Rejoindre « {{title}} » », corps sans session, se connecter, créer un compte, rejoindre, déjà membre) dans `locales/{fr,en}/mobile.json`. Réutiliser `public:invite.*` du site quand le texte est le même.
- [X] T028 [US2] Créer `mobile/app/links/invite/[token].tsx`.
  - Sans session : `setPendingLink("/links/invite/<token>")`, puis les boutons « Se connecter » (`/login`) et « Créer un compte » (`/register`).
  - Connecté : `GET /invitations/{token}`. Si `listId` est rempli, l'écran fait `router.replace("/lists/<listId>")`. Sinon il affiche le titre et « Rejoindre ».
  - Au toucher de « Rejoindre » : `POST …/accept`, puis `syncNow()`, puis `router.replace("/lists/<id>")`.
  - `emailNotVerified` : le message, plus `VerificationBanner` avec le renvoi du lien.
  - `inviteLinkBroken` et les erreurs réseau : le message du code.
  - `testID` : `invite.screen`, `invite.join`, `invite.join-error`, `invite.login`, `invite.register`, `invite.error`, `invite.retry`, `invite.home`.
- [X] T029 [US2] Dans `mobile/app/(auth)/login.tsx` et `mobile/app/(auth)/register.tsx`, lire le paramètre `next`. S'il commence par `/inviter/`, le convertir par `appPathForSiteUrl` et le passer à `setPendingLink`, pour les liens `/connexion?next=…` de la table. Dans `mobile/app/links/confirm-email/[token].tsx`, quand `suite` commence par `/inviter/`, le bouton suivant devient « Reprendre l'invitation » et mène à l'écran de l'invitation (feature 010, US1-6).
- [X] T030 [P] [US2] Créer `mobile/__tests__/screens/links-invite.test.tsx`. Il couvre :
  - sans session, le lien est gardé et la connexion proposée ;
  - après `signIn`, retour à l'invitation (via `(auth)/_layout`) ;
  - connecté non membre : titre, rejoindre, puis la liste ;
  - déjà membre : redirection directe ;
  - `emailNotVerified` : le bandeau ;
  - `inviteLinkBroken` : le message.

  Dans `links-confirm-email.test.tsx`, ajouter le cas `suite=/inviter/x`.
- [X] T031 [US2] Créer le parcours `mobile/.maestro/flows/011-us2-invite-link.yaml` (tag `011-us2`). Il ouvre le lien d'invitation de la liste de démo, dont le jeton est fixe dans la base de la suite (`demo-list-invitation`, `scripts/create-demo-data.mjs`) : pas besoin de script qui interroge l'API. Le parcours :
  - crée un compte e2e confirmé (`register.yaml`), puis se déconnecte ;
  - ouvre `ohyoushouldnt://inviter/demo-list-invitation`, vérifie `invite.login`, se connecte, et revient à l'invitation ;
  - touche `invite.join`, et vérifie l'arrivée sur la liste (`list.add-item`) ;
  - rouvre le lien, déjà membre : la liste s'ouvre tout de suite.
- [ ] T032 [US2] (à jouer à la main, choix du 2026-11-02) Jouer le parcours [quickstart US2](./quickstart.md#us2--invitation), puis `npm --prefix mobile run e2e -- .maestro/flows/011-us2-invite-link.yaml`.
- [X] T033 [US2] Commit de la story : lint, types et tests verts (site et app). Créer ensuite le commit `feat: join a list from an invite link in the app (US2)`, sans demander.

**Checkpoint**: US1 et US2 marchent chacune seule. Une invitation ouverte sans session reprend après la connexion.

---

## Phase 5: User Story 3 - Proposer l'app depuis le site sur un téléphone (Priority: P2)

**Goal**: sur un téléphone, une icône animée au plus 5 s ouvre une fenêtre avec les badges App Store et Google Play.

**Independent Test**: [quickstart US3](./quickstart.md#us3--icône-de-lapp-sur-le-site). Le site n'a pas de test e2e.

### Tests for User Story 3

- [X] T034 [P] [US3] Créer `tests/domain/device.test.ts` pour `phonePlatform(userAgent, uaDataMobile)`. Cas couverts :
  - iPhone Safari et iPhone Chrome (`CriOS`) → `"ios"` ;
  - Android Chrome avec `Mobile` → `"android"` ;
  - tablette Android sans `Mobile` → `null` ;
  - iPad iPadOS (UA « Macintosh ») → `null` ;
  - Mac, Windows et Linux → `null` ;
  - `uaDataMobile: true` avec Android → `"android"`.

  Ajouter aussi un test de `appStoreUrl()` / `playStoreUrl()` : adresse `https` gardée, valeur vide ou `http://` → `null`.

### Implementation for User Story 3

- [X] T035 [P] [US3] Créer `src/site/device.ts` avec `phonePlatform`, d'après le tableau de [data-model.md](./data-model.md#plateforme-du-téléphone-phoneplatform-srcsitedevicets) :
  - « UA avec `iPhone` ou `iPod` » → `"ios"` ;
  - « UA avec `Android` et `Mobile`, ou `uaDataMobile === true` avec `Android` » → `"android"` ;
  - sinon `null`.
- [X] T036 [P] [US3] Dans `src/site/links.ts`, ajouter `appStoreUrl()` et `playStoreUrl()`, sur le modèle de `supportUrl()`. Elles lisent `APP_STORE_URL` et `PLAY_STORE_URL` et ne gardent qu'une adresse `https://`. Documenter les deux variables dans le tableau du `README.md`, dans `.env.example` et dans `deploy/compose.prod.yml` (`WHISHLIST_APP_STORE_URL`, `WHISHLIST_PLAY_STORE_URL`, vides par défaut).
- [X] T037 [P] [US3] Télécharger les badges officiels, sans les modifier, en FR et en EN :
  - « Télécharger dans l'App Store » / « Download on the App Store » depuis la page marketing d'Apple ;
  - « Disponible sur Google Play » / « Get it on Google Play » depuis la page des badges Google Play.

  Les placer dans `public/badges/fr/` et `public/badges/en/` (`app-store.svg`, `google-play.svg` ou `.png`). Noter leur source et leurs règles d'usage dans `public/badges/README.md`. Vérifier que `proxy.ts` les sert sans préfixe de langue (le `matcher` exclut déjà `.svg` et `.png`).
- [X] T038 [P] [US3] Dans `app/globals.css`, ajouter `@keyframes phone-ring` (petite oscillation, rotation de ±12° et retour) et une classe `phone-ring` (comme les animations `guest-hero__*` du même fichier) : `animation: phone-ring 1s ease-in-out 5`, soit 5 s au total, puis arrêt (SC-004). Sous `@media (prefers-reduced-motion: reduce)`, `animation: none`.
- [X] T039 [P] [US3] Ajouter les textes `getApp.*` dans `locales/fr/common.json` et `locales/en/common.json` : nom accessible du bouton (« L'app sur votre téléphone »), titre et phrase de la fenêtre, texte alternatif des deux badges, fermer. Mêmes clés dans les deux langues, en vouvoyant en français.
- [X] T040 [US3] Créer `components/site/get-app-button.tsx` (`"use client"`). Il reçoit en props `{ appStoreUrl: string | null, playStoreUrl: string | null, locale }` et fonctionne ainsi :
  - après le montage, `phonePlatform(navigator.userAgent, navigator.userAgentData?.mobile)` ; rien n'est rendu tant que ce n'est pas un téléphone, ni sans aucune adresse (FR-011, FR-015) ;
  - le bouton icône `Smartphone` (lucide-react) porte `phone-ring` tant que l'état `ringing` est vrai, et `aria-label` vaut `t("getApp.button")` ;
  - au toucher, `ringing` passe à faux, ce qui arrête aussitôt l'animation, et la fenêtre s'ouvre ;
  - la fenêtre est un `Dialog` de `components/ui/dialog.tsx` (`DialogContent`, `DialogTitle`, `DialogDescription`, `DialogClose`), avec les badges en liens externes (`rel="noopener"`) ;
  - le badge de la plateforme détectée vient en premier, et une adresse absente fait disparaître son badge.

  Réutiliser le style des boutons icônes de `components/ui/button.tsx`.
- [X] T041 [US3] Dans `app/layout.tsx`, rendre `<GetAppButton appStoreUrl={appStoreUrl()} playStoreUrl={playStoreUrl()} locale={locale} />` dans le `<header>`, après `SiteNav`, sans couvrir le contenu ni la navigation à 360 px de large (FR « l'icône ne cache ni le contenu ni les boutons »).
- [X] T042 [US3] Ajouter dans `mobile/.maestro/exclusions.md` la ligne `011-us3` (« story entière » : icône et fenêtre du site, qui n'a pas de test e2e), avec un lien vers le [quickstart US3](./quickstart.md#us3--icône-de-lapp-sur-le-site), pour que `__tests__/e2e/coverage.test.ts` reste vert.
- [ ] T043 [US3] (à jouer à la main, choix du 2026-11-02) Jouer le parcours [quickstart US3](./quickstart.md#us3--icône-de-lapp-sur-le-site) dans Chrome en mode appareil (iPhone, Pixel, iPad, ordinateur), avec et sans les variables, avec et sans `prefers-reduced-motion`, en FR et en EN. Chronométrer l'arrêt de l'animation.
- [X] T044 [US3] Commit de la story : lint, types et tests verts. Créer ensuite le commit `feat: suggest the mobile app from the website on phones (US3)`, sans demander.

**Checkpoint**: l'icône marche sur le site, indépendamment des liens de l'app.

---

## Phase 6: User Story 4 - Le lien public d'une liste ouvre l'app, même sans compte (Priority: P3)

**Goal**: le lien public ouvre une vue invité dans l'app (consulter, déverrouiller, réserver, annuler sa réservation). Un membre arrive sur sa vue membre.

**Independent Test**: [quickstart US4](./quickstart.md#us4--vue-invité) et le parcours Maestro `011-us4`.

### Tests for User Story 4

- [X] T045 [P] [US4] Créer `mobile/__tests__/features/guest-storage.test.ts`. Il couvre :
  - jeton de déverrouillage gardé par `readToken`, rendu tant que `expiresAt` n'est pas passé, supprimé après ;
  - claims gardés 90 jours, filtrés par `readToken`, retirés après annulation ou expiration ;
  - `clearGuestAccess()` vide tout.

### Implementation for User Story 4

- [X] T046 [P] [US4] Créer `mobile/src/features/guest/storage.ts` (SecureStore), d'après data-model, « Accès invité » :
  - jeton de déverrouillage par `readToken`, durée « `expiresAt` rendu par `/unlock` (14 j) », envoyé dans `X-Read-Unlock`, « supprimé à expiration ou sur un `423 readPasswordRequired` » ;
  - claims de réservation, liste unique `{ claim, readToken, expiresAt }`, « 90 j », envoyés dans `X-Reservation-Claims` pour la liste concernée, « retirés après annulation ou expiration » ;
  - `clearGuestAccess()`.
- [X] T047 [US4] Créer `mobile/src/features/guest/api.ts` : `readGuestList(readToken)`, `unlockGuestList(readToken, password)`, `reserveGuestItem(readToken, { itemId, typeId?, fromName, note })` et `cancelGuestReservation(readToken, reservationId)`. Ils passent par le client `openapi-fetch` existant, en ligne seulement (jamais par la file hors ligne, FR-010b), avec les en-têtes de `storage.ts`, le bearer s'il y a une session, et `Accept-Language` de l'app. Ils enregistrent le jeton rendu par `/unlock` et le `claim` rendu par `/reservations`.
- [X] T048 [US4] Dans `mobile/src/auth/session.ts`, `signOut()` et `deleteAccount()` appellent `clearGuestAccess()` (« oublie tout sur le téléphone »). Mettre à jour `mobile/__tests__/auth/session.test.ts`.
- [X] T049 [P] [US4] Textes de la vue invité : tous existent déjà dans le namespace `public` du site (`intro`, `allList`, `iOffer`, `buyLink`, `reservation.*`, `unlock.*`, `reserve.*`, `missingList`, `emptyList*`), réutilisés tels quels ; aucune clé ajoutée. Les erreurs passent par `errors.json`.
- [X] T050 [US4] Créer `mobile/app/guest/[readToken]/index.tsx`.
  - Avant tout appel, chercher dans la copie locale des listes (`mobile/src/data/`) une liste dont `readUrl` finit par `/l/<readToken>`. Si elle existe, `router.replace("/lists/<id>")` (US4-3).
  - Sinon, les états de data-model : `loading`, `locked` (champ mot de passe → `unlockGuestList`), `ready`, `missing`, `offline` (avec « Réessayer »).
  - En `ready` : titre, sous-titre et couverture avec le thème de la liste ; filtre par catégorie (paramètre `typeId`, aussi pour les liens `/l/<t>/types`) ; idées libres avec prix, priorité et lien ; « J'offre » → `/guest/<t>/reserve?itemId=` ; sur une idée `mine`, « Annuler ma réservation » (`cancelGuestReservation`, puis rechargement).
  - Aucune action de membre (FR-010b). Composer les composants de `mobile/src/ui/` (cartes d'idée de la vue membre, `Accordion` des catégories) et suivre la page publique du site (captures de `specs/005-mobile-list-app/design/web-mobile/`).
  - `testID` : `guest.screen`, `guest.title`, `guest.item-<index>`, `guest.offer-<index>`, `guest.cancel-<index>`, `guest.cancel-confirm-<index>`, `guest.password`, `guest.unlock`, `guest.missing`, `guest.retry`.
  - « Voir comme un invité » de l'écran d'une liste (`src/features/lists/ListScreen.tsx`) ouvre cette vue avec `preview=1`, qui saute la redirection des membres : en production, le lien public ouvrirait l'app elle-même et ramènerait le membre sur sa liste.
- [X] T051 [US4] Créer `mobile/app/guest/[readToken]/reserve.tsx`, le formulaire « Je veux offrir » comme `app/l/[readToken]/reserver/page.tsx`. Il prend `itemId` (idée choisie) ou le choix d'une catégorie puis d'une idée, plus `fromName` et `note` (facultatif), avec le rappel de confidentialité du site. L'envoi fait `reserveGuestItem`. En cas de succès, retour à la vue invité, idée marquée `mine`. En erreur : idée déjà prise (message du site, liste rechargée), réseau (erreur habituelle, rien de mis en attente). `testID` : `guest-reserve.screen`, `guest-reserve.from-name`, `guest-reserve.note`, `guest-reserve.submit`, `guest-reserve.error`, `guest-reserve.unavailable`.
- [X] T052 [P] [US4] Créer les tests d'écran :
  - `mobile/__tests__/screens/guest-list.test.tsx` : liste lue sans session ; membre redirigé ; liste protégée (mot de passe faux puis bon, jeton gardé) ; `missing` ; hors ligne ; filtre par catégorie ; annulation de sa réservation ;
  - `mobile/__tests__/screens/guest-reserve.test.tsx` : réservation réussie (claim gardé) ; idée déjà prise ; hors ligne sans mise en file (la file `mobile/src/offline/` reste vide).
- [X] T053 [US4] Créer le parcours Maestro `mobile/.maestro/flows/011-us4-guest-list.yaml` (tag `011-us4`). Il ouvre le lien public de la liste de démo, au jeton fixe dans la base de la suite (`demo-list-lecture`). Le parcours :
  - app déconnectée, ouvre le lien au schéma ;
  - vérifie `guest.title` ;
  - touche `guest.offer-0`, saisit le nom, valide, et vérifie « Réservé par vous » ;
  - annule, et vérifie que `guest.offer-0` revient.
  Il commence par `login.yaml` puis `logout.yaml` : la preuve du serveur local avant d'écrire (README de la suite).
- [ ] T054 [US4] (à jouer à la main, choix du 2026-11-02) Jouer le parcours [quickstart US4](./quickstart.md#us4--vue-invité), dont la liste protégée et la vue d'un membre, puis `npm --prefix mobile run e2e -- .maestro/flows/011-us4-guest-list.yaml`.
- [X] T055 [US4] Commit de la story : lint, types et tests verts (site et app). Créer ensuite le commit `feat: guest view of a shared list in the app (US4)`, sans demander.

**Checkpoint**: les quatre stories marchent chacune seule.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: documentation d'exploitation, vérifications d'ensemble.

- [X] T056 [P] Dans `README.md` (section déploiement) et `deploy/DEPLOY-RUNTIPI.md`, ajouter « Liens de l'app », qui explique :
  - où lire l'identifiant d'équipe Apple et les empreintes Play (Play Console → Intégrité de l'app → Signature de l'app : clé de signature et clé d'envoi) ;
  - comment vérifier l'association : `curl -sI`, le CDN d'Apple (`app-site-association.cdn-apple.com`), `adb shell pm get-app-links` ;
  - que le build 1.1.0 est nécessaire.
- [X] T057 [P] (fait : aucun texte ne disait « ouvre le site » ; en revanche « Gérer le partage sur le site » ouvre `/listes/{id}?onglet=partage` dans le navigateur, donc `/listes/:id` est retiré des chemins revendiqués, sinon le bouton rouvrirait l'app) Mettre à jour la page Partage de l'app (`mobile/app/(app)/lists/[listId]/share.tsx`), seulement si son texte dit que le lien public « ouvre le site » : la phrase devient « ouvre l'app si elle est installée, le site sinon ». Mettre à jour la FAQ et le guide du site (`locales/{fr,en}/content.json`) s'ils disent la même chose.
- [ ] T058 (à jouer à la main, choix du 2026-11-02) Lancer toute la suite Maestro (`DEMO_PASSWORD=… npm --prefix mobile run e2e`) sur iOS, puis sur Android si un émulateur est disponible, pour vérifier que les parcours 005 à 010 restent verts avec `+native-intent` et le lien en attente.
- [ ] T059 (à jouer à la main, après déploiement et build 1.1.0) Jouer le parcours « Production » du [quickstart](./quickstart.md#production-une-fois-après-déploiement-et-builds-110) une fois le serveur déployé avec les variables et le build 1.1.0 installé (TestFlight, test fermé Play). Le déploiement et les builds se lancent à la main, hors de ces tâches. Noter le résultat dans `quickstart.md`.
- [X] T060 Commit Polish : créer `chore: document app links setup (011)`, sans demander. La revue de code (`wishlist-feature-review`) est lancée ensuite par le hook `after_implement`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** : aucune dépendance.
- **Foundational (Phase 2)** : après le Setup. Bloque US1, US2 et US4, pas US3.
- **US1 (Phase 3)** : après la phase 2.
- **US2 (Phase 4)** : après la phase 2. T029 retouche l'écran de confirmation de US1 : faire US1 d'abord, ou sauter cette partie de T029 si US1 n'est pas faite.
- **US3 (Phase 5)** : après le Setup seulement.
- **US4 (Phase 6)** : après la phase 2. Elle est indépendante de US1 et US2.
- **Polish (Phase 7)** : après les stories voulues.

### Within Each User Story

- Tests de domaine et d'API (T010, T011, T022, T023, T034, T045) écrits d'abord et rouges.
- Commande → route → contrat et `api:types` → textes → écrans → tests d'écran → parcours Maestro → quickstart → commit.
- La tâche « Commit de la story » est la dernière de la phase : elle suit le parcours de vérification de la story.

### Parallel Opportunities

- Phase 2 : T003, T005 et T009 en parallèle, une fois T002 fait.
- US1 : T010, T011 et T015 en parallèle, puis T016 et T017, puis T018.
- US3 : T034 à T039 en parallèle, puis T040 et T041.
- US4 : T045, T046 et T049 en parallèle.
- US3 peut avancer en même temps que la phase 2 et que US1.

---

## Parallel Example: User Story 3

```bash
Task: "Créer tests/domain/device.test.ts (phonePlatform)"
Task: "Créer src/site/device.ts (phonePlatform)"
Task: "Ajouter appStoreUrl / playStoreUrl dans src/site/links.ts + variables"
Task: "Télécharger les badges dans public/badges/{fr,en}/"
Task: "Ajouter @keyframes phone-ring dans app/globals.css"
Task: "Ajouter getApp.* dans locales/{fr,en}/common.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 puis phase 2 (table, fichiers d'association, `+native-intent`).
2. Phase 3 (US1) : les e-mails de compte s'ouvrent dans l'app.
3. **STOP and VALIDATE** : quickstart US1 et Maestro `011-us1`.
4. Déployer le site (fichiers d'association et variables), puis builder l'app 1.1.0.

### Incremental Delivery

1. Fondation + US1 → build 1.1.0 (MVP).
2. US3 peut être déployée seule sur le site à tout moment, même avant le build 1.1.0. L'icône n'apparaît qu'une fois une adresse de fiche réglée.
3. US2, puis US4, chacune avec son commit et son parcours.
