---

description: "Tâches de la feature 010 : validation de l'adresse e-mail et changement d'adresse"
---

# Tasks: Validation de l'adresse e-mail et changement d'adresse

**Input**: documents de `specs/010-email-verification-change/` ([plan](./plan.md), [spec](./spec.md), [research](./research.md), [data-model](./data-model.md), [contrat](./contracts/api.md), [quickstart](./quickstart.md))

**Tests**: inclus. AGENTS.md demande un test de domaine pour chaque règle métier et chaque cas limite, et un parcours e2e (ou une exclusion) pour chaque story de l'app.

**Organization**: tâches groupées par user story. Le site, l'API et l'app mobile sont concernés.

**Points à confirmer avant de commencer** (voir le plan) : `MAIL_DRY_RUN` absent de `deploy/compose.prod.yml` (T006) ; seul `010-us3` a un parcours Maestro (T030, T049).

## Un commit par user story (règle du projet)

Chaque phase de user story se termine par une tâche **« Commit de la story »**, la dernière de la phase. Règles :

- Les phases Setup et Foundational n'ont pas de commit propre : elles entrent dans le commit de la première story.
- Chaque commit est vert (lint, types, tests). Un test existant à adapter va dans le commit de la story qui rend l'adaptation nécessaire.
- Un fichier modifié par deux stories est commité en deux temps (seulement les changements de la story en cours).
- La phase Polish a son propre commit (`chore:` ou `feat:` selon le contenu). Les corrections de la revue lancée par le hook `after_implement` forment un commit à part, `fix: corrections de la revue`, avec `review.md`.
- Message en anglais, préfixé `feat:`, `fix:` ou `chore:`, terminé par `(USn)`.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : peut se faire en parallèle (fichiers différents, sans dépendance à une tâche inachevée)
- **[Story]** : US1, US2 ou US3 (spec.md)

---

## Phase 1: Setup

**Purpose**: rien à installer (aucune nouvelle dépendance). Vérifier le point de départ.

- [X] T001 Vérifier que `npm run lint`, `npm run typecheck`, `npm test` et `npm --prefix mobile test` sont verts sur la branche `010-email-verification-change` avant tout changement, et lire `node_modules/next/dist/docs/` sur les server actions et les pages dynamiques (`params` en `Promise`) avant d'écrire la page de confirmation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: modèle, base, configuration de l'envoi et contrat, dont dépendent les trois stories.

**⚠️ CRITICAL**: aucune story ne commence avant la fin de cette phase.

- [X] T002 Ajouter à `src/domain/types.ts` : `User.emailVerifiedAt: string | null` (commentaire : « null : adresse non vérifiée ») ; l'interface `EmailConfirmation { id; userId; purpose: "verify" | "change"; email; tokenHash; expiresAt; createdAt }` ; `Database.emailConfirmations: EmailConfirmation[]` ; la collection vide dans `emptyDatabase()`. Corriger les constructions de `User` et de `Database` que `npm run typecheck` signale (tests compris, en les complétant avec `emailVerifiedAt` et `emailConfirmations: []`)
- [X] T003 Dans `src/store/schema.ts` : colonne `emailVerifiedAt: text("email_verified_at")` (nullable) sur `users` ; table `emailConfirmations` = `email_confirmations` avec `id` (clé primaire), `user_id` (non nul, `references(() => users.id)`), `purpose` (texte non nul, `CHECK (purpose in ('verify','change'))`), `email` (non nul), `token_hash` (non nul, unique), `expires_at`, `created_at` (non nuls) ; index `email_confirmations_user_id` et index unique `email_confirmations_user_purpose` sur (`user_id`, `purpose`). Sans `ON DELETE CASCADE`
- [X] T004 Lancer `npm run db:generate`, puis relire `drizzle/0001_*.sql` et y ajouter à la main, après l'`ALTER TABLE`, la reprise des comptes existants : `UPDATE users SET email_verified_at = created_at;` (R6, FR-005b). Versionner le SQL et `drizzle/meta/`
- [X] T005 Brancher la collection dans `src/store/rows.ts` (`COLLECTIONS.emailConfirmations: byId(schema.emailConfirmations)`, `COLLECTION_NAMES` après `passwordResets`, lecture `orderBy(rowid)` dans `readAll`) et dans `src/store/legacy-json.ts` : collection facultative (`OPTIONAL`), champs contrôlés, `tokenHash` en double, référence au compte (`ofUser`), `users.emailVerifiedAt: "string?"`, normalisé à `createdAt` quand il manque. Tests dans `tests/domain/store-rows.test.ts` et `tests/domain/store-import.test.ts` : un ancien fichier sans le champ donne des comptes vérifiés à leur date de création, et une confirmation qui vise un compte absent est refusée
- [X] T006 Dans `src/server/mail.ts` : `mailDryRun()` (`process.env.MAIL_DRY_RUN === "1"` et `NODE_ENV !== "production"`) et `emailVerificationRequired()` (`mailConfigured() || mailDryRun()`). En mode simulé, `sendMail` écrit dans `data/mail.log` (raison « envoi simulé ») et rend `{ sent: false }`. Documenter `MAIL_DRY_RUN` dans le tableau des variables du `README.md` (« développement uniquement, ignorée en production ») et dans `.env.example`, mais pas dans `deploy/compose.prod.yml` (écart noté dans le plan). Test dans un nouveau `tests/domain/mail-config.test.ts` : la variable est ignorée quand `NODE_ENV=production`
- [X] T007 Ajouter à `src/domain/users.ts` une `registerUser` qui crée les comptes avec `emailVerifiedAt: null`, et à `scripts/create-demo-data.mjs` les comptes de démo marqués vérifiés (`emailVerifiedAt` = leur `createdAt`). Mettre à jour `tests/domain/accounts.test.ts` et `tests/domain/demo-seed.test.ts`
- [X] T008 Reporter dans `specs/004-mobile-api/contracts/openapi.yaml` la partie US1 de [contracts/api.md](./contracts/api.md) : version `1.3.0` et sa note ; `Me.emailVerified` requis ; la réponse 403 `emailNotVerified` sur `POST /lists`, `POST /lists/{listId}/invitations` et `POST /invitations/{inviteToken}/accept`. Puis `npm --prefix mobile run api:types`. US2 (T036) et US3 (T044) reportent leurs routes avec leur code, pour que `tests/domain/api-contract.test.ts` reste vert à chaque commit
- [X] T009 Ajouter à `src/server/api/errors.ts` `emailNotVerified: 403` et `emailAlreadyVerified: 409`, et créer dans `locales/fr/errors.json` et `locales/en/errors.json` les codes `emailNotVerified`, `emailAlreadyVerified`, `emailUnchanged`, `confirmationLinkInvalid` et `confirmationLinkExpired`, en vouvoyant en français (« Confirmez d'abord votre adresse e-mail… »)

**Checkpoint**: la base migre et l'ancien import marche ; `emailVerificationRequired()` est disponible.

---

## Phase 3: User Story 1 - Confirmer son adresse après l'inscription (Priority: P1) 🎯 MVP

**Goal**: un nouveau compte reçoit un lien, le confirme sur le site, et ne peut créer, rejoindre ni inviter avant. Un bandeau s'affiche sur le site et dans l'app.

**Independent Test**: [quickstart, US1](./quickstart.md#us1--confirmer-son-adresse), avec `MAIL_DRY_RUN=1`.

### Tests for User Story 1

- [X] T010 [P] [US1] Créer `tests/domain/email-confirmation.test.ts` (partie validation). `createEmailVerification` remplace la demande `verify` précédente du compte et rend un jeton dont seule l'empreinte est stockée. `confirmEmail` :
  - avec un jeton valide, pose `emailVerifiedAt` et supprime la demande ;
  - refuse un jeton inconnu (`confirmationLinkInvalid`) ou déjà utilisé ;
  - refuse un jeton expiré après 24 h (`confirmationLinkExpired`) ;
  - refuse une demande `verify` dont l'`email` n'est plus l'adresse du compte (`confirmationLinkInvalid`).

  `isEmailVerified` et `maskEmail` (`camille@example.test` → `ca•••@example.test`, adresse courte comprise)
- [X] T011 [P] [US1] Dans `tests/domain/password-reset.test.ts` : une réinitialisation réussie pose `emailVerifiedAt` s'il était vide et supprime la demande `verify` (FR-007). Dans `tests/domain/account-deletion.test.ts` : `deleteAccount` supprime les `emailConfirmations` du compte. Dans `tests/domain/account-export.test.ts` : l'export contient `emailVerifiedAt` (FR-020)
- [X] T012 [P] [US1] Dans `tests/domain/commands-lists.test.ts`, `tests/domain/commands-sharing.test.ts` et `tests/domain/commands-auth.test.ts` (base temporaire via `withStore`, `MAIL_DRY_RUN=1` posé puis retiré) :
  - avec la validation exigée, un compte non vérifié reçoit `emailNotVerified` sur `createList`, `joinInvite` et `sendInvite` ;
  - un compte vérifié passe ;
  - sans validation exigée, tout passe (FR-008) ;
  - `register` crée la demande `verify`, écrit l'e-mail `email-verification` dans le journal et ajoute `?suite=` au lien quand `next` commence par `/` ;
  - `confirmEmailWithToken` rend `suite` seulement si c'est un chemin interne.

### Implementation for User Story 1

- [X] T013 [US1] Créer `src/domain/email-confirmation.ts`, en fonctions pures sur `Database` sur le modèle de `src/domain/password-reset.ts` (même `TTL`, `newSecretToken`, `hashSecretToken`, `clone`) :
  - `createEmailVerification(doc, { userId, now })`, avec `TTL_MS = 24 h` ;
  - `confirmEmail(doc, { token, now })`, qui rend `{ purpose, userId, email }` (la branche `change` vient en T039) ;
  - `isEmailVerified(user)` ;
  - `maskEmail(email)`.
- [X] T014 [US1] Dans `src/domain/password-reset.ts`, faire marquer l'adresse vérifiée par une réinitialisation réussie (`emailVerifiedAt ??= now`, demande `verify` du compte supprimée). Dans `src/domain/account.ts`, faire supprimer par `deleteAccount` les `emailConfirmations` du compte et ajouter `emailVerifiedAt` à `AccountExport.account`
- [X] T015 [US1] Ajouter à `src/server/mail.ts` `sendEmailVerificationMail({ to, confirmUrl, locale })` (tag `email-verification`) et étendre `redactMailLogBody` aux tags `email-verification` et `email-change` (FR-017). Textes `verify.subject`, `verify.intro`, `verify.cta`, `verify.openLink` et `verify.ignore` dans `locales/fr/mail.json` et `locales/en/mail.json`
- [X] T016 [US1] Ajouter `verifiedUser(ctx)` à `src/server/commands/context.ts` : comme `activeUser`, mais rend `emailNotVerified` si `emailVerificationRequired()` est vrai et `user.emailVerifiedAt` vaut `null`. L'utiliser à la place d'`activeUser` dans `createList` (`src/server/commands/lists.ts`), `joinInvite` et `sendInvite` (`src/server/commands/sharing.ts`), et nulle part ailleurs (R5)
- [X] T017 [US1] Dans `src/server/commands/auth.ts`, faire accepter à `register` un `next?: string`. Après la création, et si `emailVerificationRequired()` est vrai, `register` crée la demande dans une écriture `updateDocument`, puis envoie l'e-mail hors de la transaction. Le lien est `${ctx.origin}${withLocale(ctx.locale, "/confirmer-email/<token>")}`, suivi de `?suite=<next>` si `next` est un chemin interne. La commande rend en plus `verificationUrl`, seulement si l'e-mail n'est pas parti et que `NODE_ENV !== "production"` (même règle que `requestPasswordReset`)
- [X] T018 [US1] Créer `src/server/commands/email.ts` avec :
  - `previewEmailConfirmation(ctx, { token })`, en lecture seule : demande valide ou erreur, adresse masquée si `ctx.user` n'est pas le compte concerné ;
  - `confirmEmailWithToken(ctx, { token, suite })`, avec la limite `confirm-email` par IP à 20 par 15 minutes, qui rend `{ ok, purpose, suite }` (`suite` gardé seulement s'il commence par `/` et pas par `//`).
- [X] T019 [US1] Ajouter `emailVerified` à `MeView` et à `toMe` dans `src/server/api/views.ts` : vrai si `!emailVerificationRequired()` ou si `emailVerifiedAt` n'est pas nul. `pendingEmail` s'ajoute en US3 (T041), avec son contrat. Adapter les appelants de `toMe`
- [X] T020 [US1] Dans `src/server/actions.ts` :
  - `registerAction` passe `next` à `register` et ajoute `&lien=<verificationUrl>` à la redirection quand la commande le rend ;
  - nouvelle `confirmEmailAction(formData)` (token, suite), qui redirige vers `/confirmer-email/<token>?ok=1&suite=…` ou `?e=<code>`.
- [X] T021 [US1] Ajouter un test dans `tests/domain/api-http.test.ts` (ou dans le test de la route) : `POST /lists` d'un compte non vérifié répond 403 `emailNotVerified`. Le code vient des commandes, les routes ne changent pas
- [X] T022 [US1] Créer `app/confirmer-email/layout.tsx` (`robots: noindex`, comme `app/reinitialiser/layout.tsx`) et `app/confirmer-email/[token]/page.tsx` (`dynamic = "force-dynamic"`). La page appelle `previewEmailConfirmation`. Selon le cas, elle affiche :
  - pour un lien valide : l'adresse, masquée si besoin, et un formulaire `confirmEmailAction` avec le bouton « Confirmer » ;
  - pour un lien invalide ou expiré : l'erreur traduite (`translateError`) ;
  - après `?ok=1` : la réussite, avec « Reprendre l'invitation » si `suite` commence par `/inviter/`, sinon « Mes listes », ou « Se connecter » pour une personne non connectée.

  Composants de `components/ui/` et `LinkButton`, liens par `withLocale`, textes dans `locales/{fr,en}/auth.json` (`confirmEmail.*`)
- [X] T023 [US1] Modifier `app/inscription/page.tsx` : après `ok=1`, si la validation est exigée, afficher « Un e-mail de confirmation est parti à votre adresse » et, s'il est présent, le lien `lien` (dev seulement). Textes `register.checkInbox` et `register.devLink` dans `locales/{fr,en}/auth.json`
- [X] T024 [US1] Créer `components/site/email-verification-banner.tsx`, une `Alert` avec le message « Confirmez votre adresse e-mail… » (le bouton de renvoi vient en T034). L'afficher dans `app/layout.tsx` sous l'en-tête quand le compte est connecté, sans `mustChangePassword`, non vérifié, et que `emailVerificationRequired()` est vrai. Textes `verifyBanner.*` dans `locales/{fr,en}/auth.json`. La création de liste refusée affiche le message `emailNotVerified` existant via `translateError` : vérifier le formulaire de création et la page d'invitation (`app/inviter/[token]/page.tsx`, `?e=emailNotVerified`)
- [X] T025 [US1] Ajouter `emailVerifiedAt` à `AccountExport` dans les écrans d'export qui lisent ce type (site `app/compte/export/route.ts`, si le type l'impose)
- [X] T026 [P] [US1] App : créer `mobile/src/features/account/VerificationBanner.tsx`, qui compose `@/ui/Alert` (`testID="verify.banner"`, sans style en dur), affiché si `session.user.emailVerified === false`. L'afficher en haut de `mobile/app/(app)/index.tsx` et de `mobile/app/(app)/account.tsx`. Dans `mobile/app/(app)/index.tsx`, désactiver les deux boutons `lists.new` dans le même cas, avec le texte `emailNotVerified` sous le bouton. Textes dans `locales/{fr,en}/mobile.json` (`verify.*`) ou réutilisés depuis `auth`
- [X] T027 [US1] App : dans `mobile/src/auth/session.ts`, appeler `refreshMe()` quand `AppState` passe à `"active"` et qu'une session est ouverte, pour que le bandeau disparaisse après une confirmation dans le navigateur
- [X] T028 [P] [US1] Tests d'écran dans `mobile/__tests__/screens/account.test.tsx` et un nouveau `mobile/__tests__/screens/lists.test.tsx` (faux `fetch` de `__tests__/helpers/fetch.ts`) :
  - `emailVerified: false` affiche `verify.banner` et désactive `lists.new` ;
  - `emailVerified: true` n'affiche aucun bandeau ;
  - un retour au premier plan relit `/me`.
- [X] T029 [US1] Vérifier que `locales/fr/*.json` et `locales/en/*.json` ont les mêmes clés (`mobile/__tests__/i18n.test.ts` et les tests de locales du site)
- [X] T030 [US1] Ajouter à `mobile/.maestro/exclusions.md` la ligne `010-us1` : « Story entière dans l'app : bandeau et création refusée », avec la raison « demande l'envoi d'e-mail actif, absent du serveur e2e ; couvert par les tests d'écran » et un lien vers [quickstart, US1](./quickstart.md#us1--confirmer-son-adresse). Vérifier que `npm --prefix mobile test` (`coverage.test.ts`) passe
- [X] T031 [US1] Jouer le [quickstart US1](./quickstart.md#us1--confirmer-son-adresse) (étapes 1 à 9) et la section « Base » sur la base de démo avec `MAIL_DRY_RUN=1`
- [X] T032 [US1] Commit de la story : `npm run lint`, `npm run typecheck`, `npm test`, `npm --prefix mobile run lint`, `npm --prefix mobile run typecheck` et `npm --prefix mobile test` verts. Proposer ensuite le commit `feat: email verification at sign-up (US1)` des fichiers de T001 à T031 (Setup et Foundational compris, avec `specs/010-email-verification-change/`, sans `.specify/feature.json`). Attendre l'accord avant de le créer

**Checkpoint**: un nouveau compte confirme son adresse ; sans confirmation, il ne crée, ne rejoint ni n'invite.

---

## Phase 4: User Story 2 - Renvoyer le lien de confirmation (Priority: P2)

**Goal**: depuis le bandeau ou « Mon compte », sur le site et dans l'app, demander un nouveau lien, qui invalide le précédent.

**Independent Test**: [quickstart, US2](./quickstart.md#us2--renvoyer-le-lien).

### Tests for User Story 2

- [X] T033 [P] [US2] Dans `tests/domain/commands-auth.test.ts`, ou dans un nouveau `tests/domain/commands-email.test.ts`, tester `resendEmailVerification` :
  - elle crée une nouvelle demande, l'ancien jeton est refusé et le nouveau confirme ;
  - un compte déjà vérifié, ou la validation non exigée, donne `emailAlreadyVerified` sans e-mail ;
  - la 6ᵉ demande dans l'heure est refusée (limite de débit) ;
  - un compte avec `mustChangePassword` reçoit `mustChangePassword`.

### Implementation for User Story 2

- [X] T034 [US2] Ajouter à `src/server/commands/email.ts` `resendEmailVerification(ctx)` : `activeUser`, `rateLimitForIp("email-verification:<id>", ctx.ip, 5, 60 * 60 * 1000)`, refus `emailAlreadyVerified`, `createEmailVerification` sous `updateDocument`, puis `sendEmailVerificationMail`. Elle rend `{ ok: true, sent, verificationUrl }`, avec `verificationUrl` seulement en dev quand l'e-mail n'est pas parti
- [X] T035 [US2] Ajouter à `src/server/actions.ts` `resendEmailVerificationAction()`, qui redirige vers la page d'origine (champ caché `back`, validé par `nextPath`) avec `?verify=sent`, `?verify=rate` ou `?verify=already`. Ajouter au bandeau `components/site/email-verification-banner.tsx` le formulaire « Renvoyer le lien » et le message de retour, et faire proposer le même renvoi par `app/confirmer-email/[token]/page.tsx` sur un lien invalide quand le compte connecté n'est pas vérifié. Textes dans `locales/{fr,en}/auth.json`
- [X] T036 [US2] Reporter `POST /me/email-verification` dans `specs/004-mobile-api/contracts/openapi.yaml` ([contracts/api.md](./contracts/api.md)), lancer `npm --prefix mobile run api:types`, puis créer `app/api/v1/me/email-verification/route.ts` (`POST`, `withApi`, `commandContext`), qui rend `202 { sent }` ou `apiError`, dans le style de `app/api/v1/me/password/route.ts`
- [X] T037 [US2] App : ajouter au `VerificationBanner` le bouton « Renvoyer le lien » (`testID="verify.resend"`, `useServerAction`, `api.POST("/me/email-verification")`), avec la confirmation « Lien envoyé » (`testID="verify.sent"`), l'erreur traduite et `NetworkNote` hors ligne. Ajouter un test dans `mobile/__tests__/screens/account.test.tsx` : appui, appel de la route, confirmation, puis erreur `emailAlreadyVerified`
- [X] T038 [US2] Ajouter à `mobile/.maestro/exclusions.md` la ligne `010-us2`, « Story entière dans l'app », avec la même raison que `010-us1` et un lien vers [quickstart, US2](./quickstart.md#us2--renvoyer-le-lien). Jouer le quickstart US2, puis faire le commit de la story : les six commandes de vérification vertes, puis proposer `feat: resend the email confirmation link (US2)` des fichiers de T033 à T038 (dont la partie US2 de `openapi.yaml` et `mobile/src/api/schema.d.ts`). Attendre l'accord avant de le créer

**Checkpoint**: un lien perdu se remplace depuis le site ou l'app.

---

## Phase 5: User Story 3 - Changer son adresse e-mail (Priority: P2)

**Goal**: depuis « Mon compte », avec le mot de passe actuel, demander une nouvelle adresse ; elle s'applique à la confirmation, et l'ancienne adresse est prévenue.

**Independent Test**: [quickstart, US3](./quickstart.md#us3--changer-dadresse).

### Tests for User Story 3

- [X] T039 [P] [US3] Compléter `tests/domain/email-confirmation.test.ts`. `requestEmailChange` :
  - refuse un mauvais mot de passe (`wrongCurrentPassword`), sans rien créer ;
  - refuse `emailInvalid`, `emailTaken` et `emailUnchanged`, y compris pour la même adresse dans une autre casse ou avec des espaces ;
  - crée une demande `change` qui remplace la précédente ;
  - en mode `immediate`, applique l'adresse et `emailVerifiedAt`.

  `cancelEmailChange` supprime la demande. `confirmEmail` en `change` :
  - applique l'adresse, pose `emailVerifiedAt` et supprime les demandes `change` et `verify` ;
  - refuse `emailTaken` si l'adresse a été prise entre-temps, en supprimant la demande et en laissant l'adresse inchangée.

  `pendingEmailChange` rend l'adresse en attente. Ajouter aussi le test de l'export (`pendingEmail`) dans `tests/domain/account-export.test.ts`
- [X] T040 [P] [US3] Dans `tests/domain/commands-email.test.ts`, tester les commandes (base temporaire) :
  - `requestOwnEmailChange` avec la validation exigée : l'e-mail `email-change` part vers la nouvelle adresse, et la connexion marche encore avec l'ancienne ;
  - la confirmation : connexion avec la nouvelle adresse, refus avec l'ancienne, avis `email-changed` vers l'ancienne adresse, avec la nouvelle masquée et sans lien d'action ;
  - sans validation exigée : changement immédiat (FR-015) ;
  - la limite de 5 par heure ;
  - `requestPasswordReset` après le changement envoie vers la nouvelle adresse (FR-016).

### Implementation for User Story 3

- [X] T041 [US3] Ajouter à `src/domain/email-confirmation.ts` :
  - `requestEmailChange(doc, { userId, email, currentPassword, immediate, now })` (async, `verifyPassword`, `normalizeEmail`) ;
  - `cancelEmailChange(doc, { userId })` ;
  - `pendingEmailChange(doc, userId)` ;
  - la branche `change` de `confirmEmail`, qui réutilise `setUserEmail` de `src/domain/users.ts` (adapté pour poser `emailVerifiedAt = now`).

  Remplir `pendingEmail` dans `toMe` (`src/server/api/views.ts`, qui reçoit alors `doc`) et ajouter `pendingEmail` à `AccountExport.account` (`src/domain/account.ts`)
- [X] T042 [US3] Ajouter à `src/server/mail.ts` `sendEmailChangeMail({ to, confirmUrl, locale })` (tag `email-change`) et `sendEmailChangedNoticeMail({ to, maskedNewEmail, resetUrl, locale })` (tag `email-changed`, vers « Mot de passe oublié », sans lien de confirmation). Textes `change.*` et `changed.*` dans `locales/{fr,en}/mail.json`
- [X] T043 [US3] Ajouter à `src/server/commands/email.ts` :
  - `requestOwnEmailChange(ctx, { email, currentPassword })`, avec `activeUser`, la limite `email-change:<id>` à 5 par heure, `immediate = !emailVerificationRequired()` et l'envoi hors de la transaction ;
  - `cancelOwnEmailChange(ctx)`.

  Dans `confirmEmailWithToken`, faire envoyer l'avis à l'ancienne adresse après la confirmation d'un `change`. Les deux commandes rendent `{ ok, user, pendingEmail, sent }`
- [X] T044 [US3] Reporter dans `specs/004-mobile-api/contracts/openapi.yaml` `Me.pendingEmail` (requis), `POST /me/email` et `DELETE /me/email`, puis lancer `npm --prefix mobile run api:types` et créer `app/api/v1/me/email/route.ts` : `POST` (corps `email` et `currentPassword` via `text()`, réponse `200 Me`) et `DELETE` (`200 Me`), suivant [contracts/api.md](./contracts/api.md). `tests/domain/api-contract.test.ts` doit alors passer entièrement
- [X] T045 [US3] Ajouter à `src/server/actions.ts` `requestEmailChangeAction(formData)` et `cancelEmailChangeAction()`, qui redirigent vers `/compte?email=pending|changed|cancelled` ou `?e=<code>#email`. Ajouter à `app/compte/page.tsx` une carte « Adresse e-mail » (`id="email"`) qui montre :
  - l'adresse actuelle et son état (vérifiée ou non) ;
  - le changement en attente, avec le bouton « Annuler » ;
  - le formulaire « Nouvelle adresse » et « Mot de passe actuel ».

  Extraire le formulaire dans `components/site/email-change-form.tsx` s'il a besoin d'état client. Textes `account.email.*` dans `locales/{fr,en}/auth.json`. Réutiliser `Card`, `Field` et `Input` de `components/ui/`
- [X] T046 [US3] Faire afficher la réussite d'un `change` par `app/confirmer-email/[token]/page.tsx` : « Votre adresse de connexion est maintenant … », et le refus `emailTaken` avec son message
- [X] T047 [P] [US3] App : créer `mobile/src/features/account/EmailCard.tsx`, une `CollapsibleCard` repliée par défaut (`testID="account.email"`), qui affiche :
  - l'adresse actuelle ;
  - le changement en attente (`account.email.pending`) et le bouton `account.email.cancel` (`DELETE /me/email`) ;
  - les champs `account.email.new` et `account.email.password`, et le bouton `account.email.submit` (`POST /me/email`, `updateMe` avec la réponse) ;
  - les messages de réussite ou d'erreur, et `NetworkNote` hors ligne.

  La placer après la carte « Profil » dans `mobile/app/(app)/account.tsx`. Sans style en dur : uniquement des composants de `mobile/src/ui/`
- [X] T048 [P] [US3] Ajouter des tests d'écran dans `mobile/__tests__/screens/account.test.tsx` :
  - la demande en attente affiche la nouvelle adresse et l'annulation l'efface ;
  - le changement immédiat met à jour l'adresse affichée ;
  - les erreurs `wrongCurrentPassword` et `emailTaken` s'affichent dans la carte.
- [X] T049 [US3] Créer `mobile/.maestro/flows/010-us3-change-email.yaml` (tag `010-us3`, serveur e2e sans e-mail, donc changement immédiat). Le parcours :
  1. s'inscrit avec un compte `@example.test` neuf (subflow `register`) ;
  2. ouvre « Mon compte » et déplie `account.email` ;
  3. saisit une nouvelle adresse `@example.test` et le mot de passe, puis envoie ;
  4. vérifie la nouvelle adresse affichée ;
  5. se déconnecte et se reconnecte avec la nouvelle adresse (subflow `submit-login`).

  Si la saisie du mot de passe bloque sur iOS (comme `009-us2`), ajouter la ligne d'exclusion correspondante. `npm --prefix mobile test` vérifie les `testID`
- [X] T050 [US3] Jouer le [quickstart US3](./quickstart.md#us3--changer-dadresse) (étapes 1 à 9) et la section « Export et suppression », puis lancer `DEMO_PASSWORD=… npm --prefix mobile run e2e -- .maestro/flows/010-us3-change-email.yaml` — quickstart joué sur le site et l’API le 2026-11-01 ; parcours Maestro pas encore lancé (simulateur nécessaire)
- [X] T051 [US3] Commit de la story : les six commandes de vérification vertes, puis proposer le commit `feat: change the account email address (US3)` des fichiers de T039 à T050. Attendre l'accord avant de le créer

**Checkpoint**: les trois stories fonctionnent, chacune vérifiable seule.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T052 [P] Relire les textes FR et EN ajoutés (vouvoiement, lexique du produit, « adresse e-mail » partout) dans `locales/fr/auth.json`, `locales/fr/mail.json`, `locales/fr/errors.json` et `locales/fr/mobile.json`, ainsi que leurs équivalents `en`
- [X] T053 [P] Mettre à jour la FAQ et le guide si elles parlent de l'inscription ou de l'adresse de connexion (`app/faq/page.tsx`, `locales/{fr,en}/content.json`), ainsi que la page « Données personnelles » (`app/donnees-personnelles/page.tsx`, contenu dans `locales/{fr,en}/content.json`) : date de vérification de l'adresse et demandes de confirmation conservées 24 h
- [X] T054 Vérifier que `npm run db:check -- tmp/demo-wishlist.db --counts` et `node scripts/db-backup.mjs tmp/backup-test.db` passent avec la nouvelle table, puis jouer une fois le démarrage sur une copie de la base de prod (quickstart, « Base », étape 3) — démarrage sur une copie de la prod non joué (données personnelles), reprise couverte par le test de migration
- [X] T055 Préparer les commandes de déploiement sur `macbuntu` (pull, rebuild, recréation du conteneur avec `WHISHLIST_DATA_DIR`), sans les lancer, et la vérification de prod du quickstart. Les donner à lancer, puis proposer le commit `chore: polish email verification docs (010)` des fichiers de T052 à T054. Attendre l'accord avant de le créer

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** : aucune.
- **Foundational (Phase 2)** : après Setup ; bloque toutes les stories. T003 → T004 → T005 ; T002 avant T003 et T007 ; T008 avant tout travail dans l'app (types générés).
- **US1 (Phase 3)** : après Foundational.
- **US2 (Phase 4)** : après US1 (réutilise `createEmailVerification`, le bandeau et `VerificationBanner`).
- **US3 (Phase 5)** : après Foundational. Elle réutilise de US1 `confirmEmail`, la page de confirmation, `maskEmail` et `toMe`. On peut la commencer en parallèle de US2 une fois US1 faite.
- **Polish (Phase 6)** : après les stories voulues.

### Within Each User Story

- Tests de domaine (T010 à T012, T033, T039 et T040) écrits d'abord, et en échec.
- Domaine → commandes → actions et routes → pages → app.
- La tâche « Commit de la story » est la dernière de la phase : elle suit le parcours du quickstart.

### Parallel Opportunities

- Foundational : T006, T007 et T009 en parallèle après T002.
- US1 : T010, T011 et T012 ensemble ; côté app, T026 et T028 en parallèle du site (T022 à T024) une fois T019 fait.
- US3 : T039 et T040 ensemble ; T047 et T048 (app) en parallèle de T045 et T046 (site) une fois T044 fait.

---

## Parallel Example: User Story 1

```bash
Task: "Tests de domaine de la validation dans tests/domain/email-confirmation.test.ts (T010)"
Task: "Tests reset, suppression et export (T011)"
Task: "Tests des gardes et de register dans tests/domain/commands-*.test.ts (T012)"

# Une fois T019 fait :
Task: "Page /confirmer-email et bandeau du site (T022 à T024)"
Task: "VerificationBanner et création désactivée dans l'app (T026, T028)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 et Phase 2 (base, envoi simulé, contrat).
2. Phase 3 (US1) : la validation à l'inscription et la garde.
3. **STOP and VALIDATE** : quickstart US1 avec `MAIL_DRY_RUN=1`.
4. Déployable seule : la prod a déjà Resend, les comptes existants sont vérifiés, et seuls les nouveaux confirment.

### Incremental Delivery

1. US1 → déployer (MVP).
2. US2 (renvoi) → déployer. Sans elle, un e-mail perdu se rattrape par « Mot de passe oublié », qui vaut aussi confirmation.
3. US3 (changement d'adresse) → déployer.
4. Publier une nouvelle version de l'app après US1 (bandeau) ou après US3 (carte « Adresse e-mail »). Les anciennes versions restent compatibles.

---

## Notes

- Une écriture passe toujours par `updateDocument`. Les e-mails partent après la transaction, jamais dedans.
- Aucun jeton en clair dans la base, ni dans `mail.log` en production.
- Aucune adresse réelle dans le dépôt : `@example.test` partout.
