# Implementation Plan: Stockage des données dans une base embarquée

**Branch**: `008-sqlite-storage` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-sqlite-storage/spec.md`

## Summary

Remplacer le fichier `data/wishlist.json` par une base SQLite (mode WAL) décrite avec Drizzle, en deux étapes livrées l'une après l'autre.

- **Étape 1** (US1, US2, US3, US5) : `readDocument`, `getDocument` et `updateDocument` gardent leur signature mais lisent et écrivent la base. Au démarrage du serveur (`instrumentation.ts`), le store applique les migrations et importe une seule fois l'ancien fichier, tout ou rien, après un contrôle d'intégrité. Une écriture prend une transaction `BEGIN IMMEDIATE` et n'écrit que le différentiel. Rien d'autre ne change dans le code.
- **Étape 2** (US4) : les commandes, l'authentification et les pages chargent des **portées** (une liste, un compte, une session…) par requêtes ciblées, et les mêmes fonctions pures du domaine tournent dessus. Plus aucun accès à tout le document dans `app/` ni `src/server/`.

Détail des choix : [research.md](./research.md). Tables : [data-model.md](./data-model.md). Interface du store : [contracts/store.md](./contracts/store.md). Parcours de vérification : [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.8, Node.js 20+ en dev (24 en local), `node:22-bookworm-slim` dans l'image.

**Primary Dependencies**: Next.js 16.4 (App Router, `output: "standalone"`) ; nouvelles : `better-sqlite3` ^12.11 (R1), `drizzle-orm` ^0.45 ; dev : `drizzle-kit` ^0.31, `@types/better-sqlite3`. Retirée en fin d'étape 1 : `proper-lockfile` (et `src/store/file.ts`).

**Storage**: SQLite en WAL, fichier `/data/wishlist.db` (dérivé de `WISHLIST_DATA_PATH`, R2), migrations versionnées dans `drizzle/`.

**Testing**: `node:test` + `tsx` (`tests/domain/*.test.ts`), base temporaire par test ; jest-expo pour l'app (inchangé) ; suite Maestro de la 007 pour la non-régression de l'app.

**Target Platform**: conteneur Linux arm64 (Mac mini, Docker), macOS en dev.

**Project Type**: application web (Next.js) + API JSON, avec une app mobile cliente de l'API (non modifiée).

**Performance Goals**: après l'étape 2, ouvrir une liste, réserver et synchroniser l'app sur une base ≥ 100 × la démo prennent au plus le double du temps sur la base de démo (SC-005, mesuré par `npm run bench:store`, R14).

**Constraints**: zéro perte à l'import (SC-001) ; aucune reconnexion (SC-003) ; contrat d'API inchangé (FR-019) ; aucune nouvelle variable d'environnement (R2) ; un seul processus serveur, mais tolérance aux autres processus sur le même fichier (workers de `next dev`, scripts) ; pas de service annexe.

**Scale/Scope**: base actuelle de quelques centaines de lignes ; dimensionné pour des milliers de comptes et de listes. 8 modules de commandes (~1 500 lignes avec `actions.ts`), 8 pages et 2 modules d'authentification qui lisent le store, ~12 fichiers de tests qui le touchent.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe / section | Vérification | Statut |
| --- | --- | --- |
| I. Données personnelles hors dépôt | La base et ses fichiers `-wal`/`-shm` sont dans le volume, ignorés par Git (`data/*.db*`). Démo, tests et bench : comptes `@example.test` seulement. Les messages d'import ne citent que des identifiants, jamais un e-mail ni un nom. | ✅ |
| II. Lecture sans compte, écriture par les membres | Aucune règle d'accès ne change : `activeUser`, `findMembership`, `canAccessPublicListWith` restent dans les commandes. À l'étape 2, le test d'équivalence vérifie les mêmes refus. | ✅ |
| III. Réservation sans collision | Renforcé : en plus de la règle du domaine sous transaction `BEGIN IMMEDIATE`, un index unique sur `reservations.item_id`. Test : 100 réservations simultanées, deux processus (SC-004). | ✅ |
| IV. Tranches testables | Étape 1 livrable et déployable seule ; étape 2 commande par commande. Chaque US a son parcours dans `quickstart.md`. | ✅ |
| V. Simplicité | Un mécanisme ajouté (base embarquée) qui sert à « tenir sur l'hébergement » avec plus de comptes ; pas de cache, pas de file de messages, pas de base serveur. Les portées réutilisent le domaine au lieu d'une couche de requêtes en double. | ✅ |
| Hébergement Docker | SQLite est un fichier du volume `/data`, sans service annexe ni base managée ; les données survivent au redémarrage. Node 20 reste possible en dev (choix de `better-sqlite3` 12.x). Aucune nouvelle variable d'environnement. Le binaire natif est fourni précompilé pour `linux-arm64` glibc (bookworm) ; à défaut, l'étape `deps` du `Dockerfile` installe `python3 make g++`. | ✅ |
| Workflow : la spec ne nomme pas le framework | La technique vient de la demande ; la spec ne la cite qu'en contexte et en hypothèse, le plan la porte. | ✅ |

Re-vérification après la phase 1 : aucun écart introduit par le modèle de données, le contrat du store ni le quickstart. Pas de ligne dans « Complexity Tracking ».

## Project Structure

### Documentation (this feature)

```text
specs/008-sqlite-storage/
├── plan.md              # ce fichier
├── research.md          # Phase 0 (R1 à R15)
├── data-model.md        # Phase 1 : tables, contraintes, portées
├── quickstart.md        # Phase 1 : parcours de vérification
├── contracts/
│   └── store.md         # Phase 1 : interface de src/store/
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
instrumentation.ts            # nouveau : ouvre le store au démarrage, refuse de démarrer si l'import échoue (R8)
drizzle.config.ts             # nouveau : configuration drizzle-kit
drizzle/                      # nouveau : migrations SQL générées, versionnées, copiées dans l'image

src/store/
├── db.ts                     # étape 1 : readDocument / getDocument / updateDocument sur SQLite, + replaceDocument, databaseFilePath
├── connection.ts             # nouveau : openStore / closeStore, pragmas, migrations, import (R4, R7, R9)
├── schema.ts                 # nouveau : tables Drizzle (data-model.md)
├── rows.ts                   # nouveau : conversions objet ↔ ligne par table
├── diff.ts                   # nouveau : écriture différentielle par clé primaire (R5)
├── legacy-json.ts            # nouveau : lecture, normalizeDocument (déplacé), checkDocument, LegacyImportError
├── scopes.ts                 # étape 2 : readScope / getScope / updateScope (R13)
└── file.ts                   # supprimé en fin d'étape 1 (proper-lockfile)

src/server/commands/*.ts      # étape 2 : updateDocument → updateScope, une commande à la fois
src/server/actions.ts         # étape 2 : resetPasswordAction et les lectures directes → portées
src/server/api/auth.ts        # étape 2 : portée apiSession
src/auth/current.ts           # étape 2 : portée user
app/**/page.tsx               # étape 2 : getDocument → getScope (8 pages)

scripts/
├── create-demo-data.mjs      # écrit la base via replaceDocument (R11)
├── db-check.ts               # nouveau : `npm run db:check -- <fichier.json|.db> [--counts]`
├── db-backup.mjs             # nouveau : sauvegarde à chaud, copié dans l'image (R10)
├── db-sessions.ts            # nouveau : sessions d'un compte, pour le contrôle du serveur e2e (R11)
├── bench-store.ts            # nouveau : `npm run bench:store` (R14)
└── backfill-og.ts            # garde updateDocument (accès complet assumé, R15)

mobile/scripts/e2e.mjs        # remise à zéro et contrôle du serveur sur la base (R11)

tests/domain/
├── store-import.test.ts      # nouveau : fidélité, normalisation, refus, tout ou rien, pas de réimport
├── store-write.test.ts       # nouveau : différentiel, rollback, ordre, droits des fichiers
├── store-concurrency.test.ts # nouveau : 100 réservations simultanées, deux processus
├── store-scopes.test.ts      # étape 2 : équivalence base complète / portée, par commande
└── (existants)               # setup via replaceDocument / readDocument au lieu du JSON écrit à la main

deploy/backup-whishlist.sh    # sauvegarde par db-backup.mjs dans le conteneur, puis chiffrement (R10)
deploy/harden-data.sh, deploy/ops-check.sh   # wishlist.db et ses fichiers annexes en 600

Dockerfile, deploy/compose.prod.yml, README.md, deploy/DEPLOY-RUNTIPI.md, AGENTS.md, .gitignore, eslint.config.mjs
```

**Structure Decision** : on reste dans les couches d'`AGENTS.md`. Tout le SQL vit dans `src/store/` ; le domaine (`src/domain/`) ne change pas et ne connaît pas la base ; les commandes changent seulement la façon de charger et d'enregistrer. La règle « une écriture passe par `updateDocument` » devient, après l'étape 2, « une écriture passe par `updateScope` (ou `updateDocument` dans les scripts) » : `AGENTS.md` est mis à jour en ce sens.

## Livraison en deux étapes

1. **Étape 1** — fin quand : tous les tests passent, `quickstart.md` US1, US2, US3, US5 confirmés, `db:check` propre sur une copie de la prod. Commit `feat:` séparé, puis **déploiement en prod** et vérification (quickstart, section « Déploiement »).
2. **Étape 2** — commence après le déploiement de l'étape 1. Une commande à la fois, chacune avec son cas dans le test d'équivalence ; les pages en dernier ; puis la règle ESLint et la mesure `bench:store`.

## Risques

| Risque | Parade |
| --- | --- |
| Données incohérentes en prod qui bloquent l'import | `db:check` sur une copie avant de déployer ; l'ancien fichier reste intact, retour arrière documenté. |
| Une clé étrangère révèle un oubli du domaine (ex. ligne liée non supprimée) | Visible au `COMMIT` dans les tests existants ; corriger le domaine (avec un test), pas désactiver la clé. |
| Module natif absent ou mal compilé dans l'image | Build Docker vérifié en fin d'étape 1 ; outils de compilation dans l'étape `deps` si le binaire précompilé manque. |
| Une portée trop petite fausse une règle du domaine (étape 2) | Tableau des portées dans le contrat, test d'équivalence par commande, index uniques en filet. |
| Une transaction tenue pendant un hachage scrypt ralentit les autres écritures | Même comportement qu'aujourd'hui (verrou de fichier) ; actions rares et limitées en débit. Hors de cette feature : sortir le hachage de la transaction. |

## Complexity Tracking

Aucun écart à la constitution à justifier.
