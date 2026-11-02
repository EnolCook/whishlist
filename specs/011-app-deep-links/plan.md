# Implementation Plan: Liens qui ouvrent l'app

**Branch**: `011-app-deep-links` | **Date**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-app-deep-links/spec.md`

## Summary

Les liens du site gardent leur adresse. Le domaine de production les associe à l'app par les liens universels iOS et les App Links Android ([research R1](./research.md#r1-mécanisme--liens-universels-ios-et-app-links-android-sur-les-adresses-actuelles)). Une table unique, `src/site/app-links.ts`, sert trois usages : elle dit quels chemins l'app traite, elle génère les fichiers `/.well-known/…` du site, et elle convertit dans l'app une adresse reçue en écran (`+native-intent.tsx`).

- **US1 (liens de compte)** : écrans `links/confirm-email` (confirmation à l'ouverture) et `links/reset-password`, sur deux nouvelles routes d'API. Elles reprennent les commandes du site ; la réinitialisation sort de la server action pour devenir une commande.
- **US2 (invitation)** : écran `links/invite`, avec un aperçu (`GET /invitations/{token}`), un bouton et l'acceptation existante. Sans session, le lien est gardé, puis repris après la connexion.
- **US3 (icône du site)** : `GetAppButton`, un bouton animé 5 s au plus (animation CSS bornée), et la fenêtre `Dialog` avec les badges des stores. Il n'apparaît que sur un téléphone, et seulement si une adresse de fiche est réglée.
- **US4 (vue invité)** : écrans `guest/[readToken]` (liste, filtre) et `guest/[readToken]/reserve`, sur les routes publiques existantes. Les jetons de déverrouillage et les claims sont gardés dans SecureStore. La réservation ne passe pas par la file hors ligne.

Tout est optionnel côté serveur. Sans `APPLE_TEAM_ID` ni `ANDROID_CERT_SHA256`, les liens ouvrent le site. Sans `APP_STORE_URL` ni `PLAY_STORE_URL`, l'icône n'apparaît pas.

Détail des choix : [research.md](./research.md). Modèle : [data-model.md](./data-model.md). Contrats : [contracts/links.md](./contracts/links.md) (chemins et fichiers d'association), [contracts/api.md](./contracts/api.md) (API 1.4.0, site, variables). Parcours : [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.8, Node.js 20+ en dev, `node:22-bookworm-slim` dans l'image ; app Expo SDK 58 (React Native 0.88, package `mobile/`).

**Primary Dependencies**:

- Site : Next.js 16.4 (App Router, route handlers sous `app/.well-known/`), i18next, Base UI (`Dialog`), lucide-react.
- App : Expo Router 58 (`+native-intent.tsx`), `expo-secure-store`, `openapi-fetch`.

Aucune nouvelle dépendance. Les badges des stores sont des fichiers statiques.

**Storage**: aucune migration. Sur le téléphone, SecureStore pour les jetons de déverrouillage et les claims de réservation de la vue invité.

**Testing**:

- `node:test` + `tsx` : `tests/domain/app-links.test.ts` (table, conversion d'adresse, fichiers d'association), `device.test.ts` (`phonePlatform`), ajouts à `commands-auth.test.ts` (`resetPasswordWithLink`), `commands-email.test.ts`, `sharing` (aperçu d'invitation), `api-http.test.ts` et `api-contract.test.ts`.
- jest-expo : `mobile/__tests__/links/` (conversion, lien en attente), écrans `links/*` et `guest/*`, et un test qui vérifie que `app.config.ts` déclare les préfixes de la table.
- Maestro : `011-us1-email-links`, `011-us2-invite-link`, `011-us4-guest-list` (par le schéma de l'app). L'US3 (site) va dans `exclusions.md` et dans le quickstart.

**Target Platform**: conteneur Linux (prod `macbuntu`, derrière Cloudflare) ; iOS et Android pour l'app (build EAS 1.1.0).

**Project Type**: application web + API JSON + app mobile cliente.

**Performance Goals**: l'écran du lien s'affiche dès l'ouverture de l'app, avec une seule requête par action. L'animation de l'icône est purement CSS.

**Constraints**:

- Liens inchangés et rétrocompatibles (FR-002) ; contrat d'API rétrocompatible (l'app 1.0.0 est soumise).
- Services optionnels (constitution, « Hébergement Docker ») ; aucun identifiant de compte développeur dans le dépôt (principe I).
- Fichiers d'association servis sans redirection, hors du `proxy.ts` de la langue.
- Pas de réservation hors ligne (principe III) ; i18n FR/EN, vouvoiement.

**Scale/Scope**:

- Site : 2 route handlers, 1 composant (bouton et fenêtre), 2 modules purs.
- API : 3 routes ; 1 commande nouvelle et 1 déplacée.
- App : 5 écrans (`links/confirm-email`, `links/reset-password`, `links/invite`, `guest/[readToken]`, `guest/[readToken]/reserve`), 1 point d'entrée `+native-intent`, 4 variables d'environnement, 3 parcours Maestro.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe / section | Vérification | Statut |
| --- | --- | --- |
| I. Données personnelles hors dépôt | L'identifiant d'équipe Apple et les empreintes Play sont des variables d'environnement, jamais dans le code (R2). Tests et Maestro en `@example.test`. Les jetons ne sont pas journalisés (R12). | ✅ |
| II. Lecture sans compte, écriture par les membres | La vue invité de l'app ne demande aucun compte pour consulter ni réserver (US4). Elle n'offre aucune action de membre (FR-010b). Les liens de compte passent par les mêmes commandes et gardes que le site (`verifiedUser`, `findMembership`). | ✅ |
| III. Réservation sans collision | La vue invité réserve par la route publique existante, qui refuse une idée déjà prise. Pas de file hors ligne pour réserver ni annuler (R9). Annuler ne vise que sa propre réservation (claim ou compte), comme sur le site. | ✅ |
| IV. Tranches testables | US1, US2, US3 et US4 sont livrables seules. US1, US2 et US4 dépendent de la table et de `+native-intent` (fondation commune). US3 ne dépend de rien d'autre. Chaque story a son parcours dans le quickstart, et chaque story de l'app a son parcours Maestro. | ✅ |
| V. Simplicité | Pas de service de liens tiers (R1). Pas de nouvelle table. La vue invité reprend l'API publique. Ouvrir les liens dans l'app sert à partager et à lire une liste (invitation, lien public) et à y accéder (liens de compte). | ✅ |
| Hébergement Docker | Les 4 variables sont optionnelles. Sans elles, le site et l'app se comportent comme avant (FR-015, SC-003). Rien de neuf dans `/data`. | ✅ |
| Workflow : la spec ne nomme pas le framework | La spec parle d'App Store, de Google Play et de l'app, sans technique. Les mécanismes (liens universels, `.well-known`) sont dans ce plan et dans la recherche. | ✅ |

Re-vérification après la phase 1 : le contrat des liens, le delta d'API et le modèle n'introduisent pas d'écart. Un point de périmètre est noté ci-dessous : la vue invité élargit l'app de la 005, ce que la spec assume.

## Project Structure

### Documentation (this feature)

```text
specs/011-app-deep-links/
├── plan.md              # ce fichier
├── research.md          # Phase 0 (R1 à R14)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── links.md         # Phase 1 : chemins revendiqués, fichiers d'association, config de l'app
│   └── api.md           # Phase 1 : delta OpenAPI 1.4.0, site, variables
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/site/
├── app-links.ts              # nouveau : APP_LINK_ROUTES, appPathForSiteUrl, appleAssociation,
│                             #   androidAssociation, androidPathPrefixes (pur, repris par l'app)
└── device.ts                 # nouveau : phonePlatform(userAgent, uaDataMobile)
src/server/
├── commands/auth.ts          # + resetPasswordWithLink (extrait de resetPasswordAction, + rate limit)
├── commands/sharing.ts       # + previewInvite (titre, listId si membre)
├── actions.ts                # resetPasswordAction → resetPasswordWithLink
└── api/                      # handlers des 3 nouvelles routes
app/
├── .well-known/apple-app-site-association/route.ts   # nouveau
├── .well-known/assetlinks.json/route.ts              # nouveau
├── api/v1/auth/email-confirmation/route.ts           # nouveau
├── api/v1/auth/password-reset/confirm/route.ts       # nouveau
├── api/v1/invitations/[inviteToken]/route.ts         # nouveau (GET)
└── layout.tsx                # + GetAppButton dans l'en-tête
proxy.ts                      # matcher : exclure .well-known/
components/site/
└── get-app-button.tsx        # nouveau : icône animée + Dialog des stores
app/globals.css               # + @keyframes phone-ring
public/badges/{fr,en}/        # badges officiels App Store et Google Play
locales/{fr,en}/
├── common.json               # textes de l'icône et de la fenêtre
├── auth.json, public.json    # réutilisés par l'app (messages identiques au site)
└── mobile.json               # textes propres aux écrans des liens et de la vue invité
specs/004-mobile-api/contracts/openapi.yaml           # 1.4.0

mobile/
├── app.config.ts             # associatedDomains + intentFilters (https seulement), version 1.1.0
├── app/
│   ├── +native-intent.tsx    # nouveau : redirectSystemPath → appPathForSiteUrl
│   ├── links/confirm-email/[token].tsx
│   ├── links/reset-password/[token].tsx
│   ├── links/invite/[token].tsx
│   ├── guest/[readToken]/index.tsx
│   ├── guest/[readToken]/reserve.tsx
│   ├── (auth)/_layout.tsx    # reprend le lien en attente après connexion
│   └── change-password.tsx   # idem après le changement imposé
├── src/links/pending.ts      # nouveau : lien en attente (mémoire)
├── src/features/guest/       # nouveau : storage.ts (SecureStore), api.ts (routes publiques)
├── src/auth/session.ts       # signOut / deleteAccount effacent aussi l'accès invité
├── src/api/schema.d.ts       # régénéré (api:types)
├── __tests__/links/, __tests__/screens/links-*.test.tsx, guest-*.test.tsx
└── .maestro/
    ├── flows/011-us1-email-links.yaml, 011-us2-invite-link.yaml, 011-us4-guest-list.yaml
    ├── scripts/app-link.js   # adresse MailDev → lien au schéma
    └── exclusions.md         # + 011-us3 (site seulement)

tests/domain/
├── app-links.test.ts, device.test.ts                 # nouveaux
└── commands-auth, commands-email, api-http, api-contract, sharing   # ajouts
```

**Structure Decision**: même découpage que les features 004 à 010.

- Les règles restent dans les commandes (`src/server/commands/`), et l'API et les server actions en sont des adaptateurs.
- Les écrans des liens et de la vue invité sont dans l'app, hors des groupes `(app)` et `(auth)`, pour ne pas être redirigés par leurs gardes.
- Le site et l'app partagent les modules purs : la table des liens rejoint `src/i18n/` et `src/domain/price.ts` parmi les modules repris par l'app.

## Complexity Tracking

Aucune violation de la constitution. Deux points d'attention, sans dérogation :

| Point | Pourquoi | Alternative plus simple écartée |
| --- | --- | --- |
| Nouveau build natif et soumission aux stores (app 1.1.0) | Les domaines associés et les filtres d'intention sont natifs : une mise à jour OTA ne suffit pas. | Une page relais au schéma (R1) n'ouvre pas l'app sans détour et ne couvre pas les liens déjà envoyés. |
| Vue invité dans l'app (hors du périmètre de la 005) | Choix fait à la clarification de la spec (2026-11-02). | Renvoyer les invités au site : écarté par ce choix. |
