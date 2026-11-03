# Implementation Plan: S'abonner à des listes pour suivre leur contenu

**Branch**: `012-list-subscriptions` | **Date**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-list-subscriptions/spec.md`

## Summary

Permettre à une personne connectée de s'abonner à une liste publique (`/l/[readToken]`) afin de la retrouver dans son espace (« Mes listes ») sur le site web comme dans l'app mobile, et d'en consulter le contenu public (idées non archivées, filtres, réservation et annulation de ses propres réservations).

- **Domaine & Stockage** : nouvelle collection `subscriptions` dans `Database` et table SQLite `subscriptions` (clé composite `(wishlistId, userId)`), avec suivi de `readPasswordHash` pour respecter les listes protégées par mot de passe de lecture et invalider l'accès si le propriétaire change le mot de passe. Retrait automatique de l'abonnement si l'abonné devient membre (`acceptInvite`), suppression en cascade (`wipeWishlist`, `deleteAccount`) et inclusion dans l'export RGPD (`exportAccount`).
- **Commandes & API v1 (1.5.0)** : commandes partagées (`subscribeToList`, `unsubscribeFromList`, `listMine` enrichi avec `subscriptions`, `readPublicList` / `unlockPublicList` compatibles avec les abonnés) ; routes `POST /api/v1/subscriptions` et `DELETE /api/v1/subscriptions/[readToken]`.
- **Site Web** : bouton « Suivre cette liste » / « Ne plus suivre » sur `/l/[readToken]`, et section « Listes suivies » avec ajout par lien sur `app/page.tsx`.
- **App Mobile** : section « Listes suivies » sur `mobile/app/(app)/index.tsx`, écran d'ajout par lien `mobile/app/(app)/shared/follow.tsx` et écran de consultation publique `mobile/app/(app)/shared/[readToken].tsx` (catégories en accordéon animé, filtres « pour qui » et budget, réservation/annulation, cache SQLite hors ligne en lecture).

Détail des décisions : [research.md](./research.md). Modèle de données : [data-model.md](./data-model.md). Contrats : [contracts/api-v1-additions.md](./contracts/api-v1-additions.md) et [contracts/screens.md](./contracts/screens.md). Parcours de vérification : [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript strict. Serveur : Node.js ≥ 20.9, Next.js 16.4. App mobile : Expo SDK 58, React Native 0.88.

**Primary Dependencies**: Aucune nouvelle dépendance (ni serveur, ni mobile).

**Storage**: SQLite (mode WAL, Drizzle ORM) côté serveur avec nouvelle migration dans `drizzle/` ; SQLite (`expo-sqlite`, table `snapshot` existante) côté app mobile.

**Testing**: `node:test` + `tsx` dans `tests/domain/*.test.ts` ; `jest-expo` + Testing Library dans `mobile/__tests__/` ; parcours e2e Maestro dans `mobile/.maestro/flows/`.

**Target Platform**: Site web (navigateurs desktop et mobile dès 320px) + App mobile iOS et Android.

**Project Type**: Application web (Next.js App Router) + API JSON (`/api/v1`) + App mobile Expo.

**Performance Goals**: Abonnement et affichage de « Mes listes » instantanés (< 200 ms) ; consultation hors ligne d'une liste suivie déjà ouverte dans l'app mobile.

**Constraints**: Confidentialité stricte vis-à-vis des membres de la liste (aucune donnée d'abonné visible par les membres) ; respect du mot de passe de lecture et de sa rotation ; aucune règle métier dans `app/` ni `mobile/`.

**Scale/Scope**: 1 table SQLite ajoutée, 1 module de domaine (`src/domain/subscription.ts`), 2 routes d'API, 2 pages du site modifiées (`app/page.tsx`, `app/l/[readToken]/page.tsx`), 1 écran mobile modifié et 2 écrans mobiles créés (`shared/follow.tsx`, `shared/[readToken].tsx`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe / section | Vérification | Statut |
| --- | --- | --- |
| I. Données personnelles hors dépôt | Tests sur bases temporaires ; démo avec comptes `@example.test`. L'export RGPD ne contient que les listes suivies par le demandeur. | ✅ |
| II. Lecture sans compte, écriture par les membres | Consulter et réserver via le lien public sans compte reste strictement inchangé. L'abonnement exige un compte actif mais ne donne aucun droit d'écriture sur la liste (lecture publique uniquement). | ✅ |
| III. Réservation sans collision | La réservation depuis une liste suivie utilise exactement la même commande `reserve` et la même règle `reserveItem` sous transaction `BEGIN IMMEDIATE` et index unique SQLite. | ✅ |
| IV. Tranches testables | US1 (site web : suivre depuis la liste publique et retrouver dans « Mes listes »), US2 (suivre par lien et consulter/réserver dans l'app mobile et sur le site), US3 (se désabonner) sont livrables et testables indépendamment. | ✅ |
| V. Simplicité | Sert directement à « partager ou lire une liste » dans la durée sans perdre le lien. Pas de notifications par e-mail, pas de fil d'actualité, pas de compteur de non-lus, pas d'annuaire public. | ✅ |
| Hébergement Docker | Aucune nouvelle variable d'environnement, aucun service externe, stockage dans la base SQLite existante `/data/wishlist.db`. | ✅ |
| Workflow | Spécification sans détails d'implémentation ; choix techniques et contrats documentés dans ce plan. | ✅ |

**Re-check après Phase 1** : ✅ Aucun écart à la constitution.

## Project Structure

### Documentation (this feature)

```text
specs/012-list-subscriptions/
├── spec.md                      # Spécification fonctionnelle
├── plan.md                      # Ce fichier
├── research.md                  # Phase 0 : décisions R1 à R7
├── data-model.md                # Phase 1 : entité Subscription, table SQLite, invariants
├── quickstart.md                # Phase 1 : parcours de validation site + app + Maestro
├── contracts/
│   ├── api-v1-additions.md      # Phase 1 : ajouts au contrat OpenAPI 1.5.0
│   └── screens.md               # Phase 1 : contrats d'interface site et app mobile
├── checklists/
│   └── requirements.md          # Checklist qualité de la spec
└── tasks.md                     # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
drizzle/
└── 0001_*.sql                               # NOUVEAU — migration Drizzle pour la table subscriptions

src/
├── domain/
│   ├── types.ts                             # + interface Subscription, + subscriptions dans Database
│   ├── subscription.ts                      # NOUVEAU — extractReadToken, findSubscription, subscribeWishlist, unsubscribeWishlist, isSubscriptionUnlocked
│   ├── membership.ts                        # wipeWishlist et acceptInvite nettoient doc.subscriptions
│   └── account.ts                           # deleteAccount nettoie doc.subscriptions ; exportAccount inclut subscriptions
├── auth/
│   └── public-list.ts                       # canAccessPublicListWith autorise l'abonné dont readPasswordHash correspond
├── store/
│   ├── schema.ts                            # + table subscriptions
│   ├── rows.ts                              # + collection subscriptions
│   └── legacy-json.ts                       # + subscriptions dans OPTIONAL, FIELDS, normalizeDocument, checkDocument
└── server/
    ├── api/
    │   └── views.ts                         # + SubscribedListSummaryView, toSubscribedListSummary, subscribed/isMember dans PublicListView
    ├── commands/
    │   ├── lists.ts                         # listMine rend { lists, subscriptions }
    │   ├── public-list.ts                   # readPublicList, unlockPublicList, subscribeToList, unsubscribeFromList
    └── actions.ts                           # + subscribeAction, subscribeByLinkAction, unsubscribeAction

app/
├── page.tsx                                 # + section « Listes suivies » et formulaire d'ajout par lien
├── l/[readToken]/page.tsx                   # + bouton « Suivre cette liste » / « Ne plus suivre »
└── api/v1/
    ├── capabilities/route.ts                # apiVersion 1.5.0
    ├── lists/route.ts                       # rend { lists, subscriptions }
    └── subscriptions/
        ├── route.ts                         # NOUVEAU — POST /api/v1/subscriptions
        └── [readToken]/route.ts             # NOUVEAU — DELETE /api/v1/subscriptions/[readToken]

locales/{fr,en}/
├── home.json                                # + clés followed.* (titre, ajout par lien, état vide, ne plus suivre)
├── public.json                              # + clés subscription.* (suivre, suivie, ne plus suivre)
├── errors.json                              # + subscriptionLinkInvalid, alreadyMember
└── mobile.json                              # + clés shared.* pour l'écran de suivi et de consultation mobile

specs/004-mobile-api/contracts/openapi.yaml  # version 1.5.0, POST/DELETE /subscriptions, SubscribedListSummary

tests/domain/
├── subscription.test.ts                     # NOUVEAU — règles pures d'abonnement, mot de passe, exclusion membre
├── commands-subscription.test.ts            # NOUVEAU — commandes et contrôle d'accès
└── (existants mis à jour)                   # account-deletion, account-export, api-contract

mobile/
├── app/(app)/
│   ├── index.tsx                            # + section « Listes suivies » et bouton « Suivre une liste »
│   └── shared/
│       ├── follow.tsx                       # NOUVEAU — écran d'ajout d'une liste suivie par lien (+ MDP si 423)
│       └── [readToken].tsx                  # NOUVEAU — écran de consultation publique d'une liste suivie
├── src/
│   ├── api/schema.d.ts                      # GÉNÉRÉ via npm --prefix mobile run api:types
│   ├── data/
│   │   ├── store.ts                         # + subscriptions dans useMyLists, cache publicList:<readToken>
│   │   └── subscriptions.ts                 # NOUVEAU — followList, unfollowList, unlockSharedList, reserveSharedItem, cancelSharedReservation
│   └── offline/
│       └── snapshot.ts                      # + subscriptionsKey, publicListKey(readToken)
├── __tests__/
│   └── screens/shared-list.test.tsx         # NOUVEAU — tests jest-expo de suivi, consultation, réservation et désabonnement
└── .maestro/flows/
    ├── 012-us2-follow-and-browse.yaml       # NOUVEAU — parcours Maestro US2
    └── 012-us3-unfollow.yaml                # NOUVEAU — parcours Maestro US3
```

**Structure Decision**: Respect strict de l'architecture en couches définie dans `AGENTS.md` : logique métier pure dans `src/domain/subscription.ts`, persistance dans `src/store/`, orchestration dans `src/server/commands/`, adaptateurs dans `src/server/actions.ts` et `app/api/v1/`, et écrans mobiles dans `mobile/app/` composant exclusivement `mobile/src/ui/`.

## Complexity Tracking

Aucune violation de la constitution.
