# Implementation Plan: Validation de l'adresse e-mail et changement d'adresse

**Branch**: `010-email-verification-change` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-email-verification-change/spec.md`

## Summary

Ajouter à chaque compte un état « adresse vérifiée » et une table de demandes de confirmation, sur le modèle de la réinitialisation du mot de passe : jeton haché, valable 24 h, une demande par compte et par motif.

- **US1 (validation)** : l'inscription crée une demande `verify` et envoie le lien. La page `/confirmer-email/[token]` confirme par un bouton. Une garde `verifiedUser` bloque la création de liste, l'acceptation et l'envoi d'invitation. Un bandeau s'affiche sur le site et dans l'app.
- **US2 (renvoi)** : une commande remplace la demande et renvoie le lien, avec 5 envois par heure au plus.
- **US3 (changement d'adresse)** : la demande `change` exige le mot de passe actuel. L'adresse change à la confirmation, puis un avis part vers l'ancienne adresse. Sans envoi d'e-mail, le changement est immédiat.

Tout dépend de `emailVerificationRequired()` : la validation est exigée quand Resend est configuré, ou en mode simulé `MAIL_DRY_RUN` (dev seulement). Sinon, rien ne change. Les comptes existants sont repris comme vérifiés.

Détail des choix : [research.md](./research.md). Modèle : [data-model.md](./data-model.md). API et pages : [contracts/api.md](./contracts/api.md). Parcours : [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.8, Node.js 20+ en dev, `node:22-bookworm-slim` dans l'image ; app Expo (package `mobile/`).

**Primary Dependencies**: Next.js 16.4 (App Router, server actions), Drizzle + `better-sqlite3`, i18next, Resend (API HTTP, optionnel) ; app : Expo Router, `openapi-fetch` (types générés). Aucune nouvelle dépendance.

**Storage**: SQLite (WAL), migration `drizzle/0001_*` : colonne `users.email_verified_at` (reprise à `created_at`), table `email_confirmations`.

**Testing**: `node:test` + `tsx` dans `tests/domain/` (nouveau `email-confirmation.test.ts`, plus des ajouts à `users`, `password-reset`, `account`, `legacy-json`, `api-contract` et aux tests des commandes) ; jest-expo pour les écrans de l'app ; Maestro `010-us3` ; le reste manuel via `quickstart.md`.

**Target Platform**: conteneur Linux (prod `macbuntu`), iOS et Android pour l'app.

**Project Type**: application web + API JSON + app mobile cliente.

**Performance Goals**: sans objet. Une requête par confirmation, et l'envoi d'e-mail se fait hors de la transaction.

**Constraints**: envoi d'e-mail optionnel (FR-008) ; aucune donnée personnelle dans le dépôt (démo `@example.test`) ; jetons jamais en clair dans la base ni dans les journaux de production ; contrat d'API rétrocompatible (app déjà publiée) ; i18n FR/EN, vouvoiement.

**Scale/Scope**: environ 4 commandes, 3 e-mails, 1 page et 1 bandeau sur le site, 1 carte et 1 bandeau dans l'app, 3 routes d'API, 1 migration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe / section | Vérification | Statut |
| --- | --- | --- |
| I. Données personnelles hors dépôt | Démo et tests en `@example.test`. Le parcours de prod du quickstart utilise une adresse personnelle hors dépôt. Les URL de confirmation sont masquées dans `mail.log` en production. | ✅ |
| II. Lecture sans compte, écriture par les membres | La lecture et la réservation sans compte sont inchangées : `publicAccount` n'a pas de garde. Créer, rejoindre et inviter exigent en plus une adresse vérifiée quand l'envoi est actif. La règle devient plus stricte, sans contredire le principe (hypothèse de la spec). | ✅ |
| III. Réservation sans collision | Non touché. | ✅ |
| IV. Tranches testables | US1 livrable seule (inscription, confirmation, garde). US2 et US3 indépendantes, sur la même table. Chaque story a son parcours dans `quickstart.md`, et `MAIL_DRY_RUN` permet de les jouer sans Resend. | ✅ |
| V. Simplicité | Pas de nouveau service : Resend existe déjà, et la table reprend `password_resets`. Le mécanisme sert à « créer, partager une liste » de façon sûre (compte joignable). Un seul ajout de configuration, `MAIL_DRY_RUN`, limité au dev. | ✅ |
| Hébergement Docker | Sans `RESEND_API_KEY`, l'app marche comme avant (FR-008, SC-005). La nouvelle table vit dans `/data`. `MAIL_DRY_RUN` est ignoré en production. | ✅ |
| Governance : « envoi d'e-mail » à justifier | La spec 010 est la justification explicite demandée. | ✅ |

Re-vérification après la phase 1 : le modèle, le contrat et le quickstart n'introduisent pas d'écart. Un écart à AGENTS.md, et non à la constitution, est noté dans « Complexity Tracking ».

## Project Structure

### Documentation (this feature)

```text
specs/010-email-verification-change/
├── plan.md              # ce fichier
├── research.md          # Phase 0 (R1 à R14)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── api.md           # Phase 1 : delta de l'OpenAPI (1.3.0), pages et actions du site
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/domain/
├── types.ts                  # User.emailVerifiedAt, EmailConfirmation, Database.emailConfirmations
├── email-confirmation.ts     # nouveau : createEmailVerification, requestEmailChange, cancelEmailChange,
│                             #   confirmEmail, pendingEmailChange, isEmailVerified, maskEmail
├── users.ts                  # registerUser : emailVerifiedAt null ; setUserEmail réutilisé (pose emailVerifiedAt)
├── password-reset.ts         # reset réussi → adresse vérifiée, demande verify supprimée
└── account.ts                # deleteAccount supprime les demandes ; export : emailVerifiedAt, pendingEmail

src/store/
├── schema.ts                 # colonne + table email_confirmations (index user_id, unique user_id+purpose, unique token_hash)
├── rows.ts                   # COLLECTIONS, COLLECTION_NAMES, readAll
└── legacy-json.ts            # emailConfirmations facultatif ; users.emailVerifiedAt "string?" → createdAt
drizzle/0001_*.sql            # généré + UPDATE users SET email_verified_at = created_at

src/server/
├── mail.ts                   # emailVerificationRequired(), MAIL_DRY_RUN, 3 nouveaux e-mails, redaction
├── commands/context.ts       # verifiedUser(ctx)
├── commands/email.ts         # nouveau : resendEmailVerification, requestOwnEmailChange, cancelOwnEmailChange,
│                             #   previewEmailConfirmation, confirmEmailWithToken
├── commands/auth.ts          # register : demande verify + e-mail (avec `next`) ; rend verificationUrl en dev
├── commands/lists.ts         # createList → verifiedUser
├── commands/sharing.ts       # joinInvite, sendInvite → verifiedUser
├── actions.ts                # 4 actions (contracts/api.md) ; registerAction passe next
├── api/views.ts              # MeView : emailVerified, pendingEmail (toMe reçoit doc + required)
└── api/errors.ts             # emailNotVerified 403, emailAlreadyVerified 409

app/
├── confirmer-email/[token]/page.tsx (+ layout.tsx, comme reinitialiser/)
├── inscription/page.tsx      # message « consultez votre boîte » (+ lien en dev)
├── compte/page.tsx           # carte « Adresse e-mail »
├── layout.tsx                # bandeau
└── api/v1/me/email/route.ts, api/v1/me/email-verification/route.ts

components/site/
├── email-verification-banner.tsx
└── email-change-form.tsx     # si la carte du compte le demande (sinon dans la page)

locales/{fr,en}/              # auth (carte, bandeau, page), errors (codes), mail (verify/change/changed)

specs/004-mobile-api/contracts/openapi.yaml   # 1.3.0 (contracts/api.md)

mobile/
├── src/api/schema.d.ts       # régénéré (api:types)
├── src/auth/session.ts       # refreshMe au retour au premier plan
├── src/features/account/     # EmailCard (carte repliable), VerificationBanner
├── app/(app)/index.tsx       # bandeau + « Créer une liste » désactivé si non vérifié
├── app/(app)/account.tsx     # bandeau + EmailCard
├── __tests__/                # écrans : bandeau, création désactivée, renvoi, changement, annulation
└── .maestro/flows/010-us3-change-email.yaml ; .maestro/exclusions.md (010-us1, 010-us2)

scripts/create-demo-data.mjs  # comptes de démo vérifiés (emailVerifiedAt = createdAt)
README.md, .env.example       # MAIL_DRY_RUN
```

**Structure Decision**: couches habituelles (AGENTS.md). Règles pures dans `src/domain/email-confirmation.ts`, orchestration dans `src/server/commands/email.ts`, adaptateurs site (actions) et API (routes `me/email*`), et l'app comme simple cliente.

## Ordre de livraison

1. **Socle** (avant US1) : types, schéma, migration, `rows.ts`, `legacy-json.ts`, `emailVerificationRequired()` et `MAIL_DRY_RUN`, démo vérifiée, contrat 1.3.0 et `api:types`.
2. **US1** : domaine (création, confirmation), garde, e-mail, page de confirmation, bandeau du site, `Me.emailVerified`, bandeau et création désactivée dans l'app, reset → vérifié, export, suppression. Commit.
3. **US2** : commande et route de renvoi, bouton du bandeau sur le site et dans l'app. Commit.
4. **US3** : domaine, commandes, routes `me/email`, carte « Adresse e-mail » sur le site et dans l'app, avis à l'ancienne adresse, parcours Maestro `010-us3`. Commit.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| `MAIL_SMTP_URL` (2026-11-02) absente de `deploy/compose.prod.yml`, nouvelle dépendance nodemailer | La suite e2e lit les e-mails dans MailDev, qui ne reçoit que du SMTP (R14) ; la variable est ignorée en production, comme `MAIL_DRY_RUN` | Envoyer à MailDev par Resend est impossible ; Mailpit (envoi HTTP) n'était pas l'outil demandé |
| `MAIL_DRY_RUN` absent de `deploy/compose.prod.yml` (AGENTS.md demande les trois endroits) | La variable n'a aucun effet en production (ignorée si `NODE_ENV=production`) : la mettre dans le compose suggérerait le contraire | La mettre au compose, vide, tromperait la personne qui exploite. Pas de variable du tout rendrait le quickstart injouable sans clé Resend (R2). À confirmer avant l'implémentation. |
