---

description: "Tâches de la feature 008 : passage du fichier JSON à SQLite (WAL, Drizzle), en deux étapes"
---

# Tasks: Stockage des données dans une base embarquée

**Input**: Design documents from `specs/008-sqlite-storage/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/store.md](contracts/store.md), [quickstart.md](quickstart.md)

**Tests**: demandés. `AGENTS.md` exige un test de domaine pour chaque règle et chaque cas limite. La spec demande que les tests existants passent sans changer leurs attentes (SC-002) et qu'un test d'équivalence couvre l'étape 2 (R13).

**Organisation** : l'ordre suit les deux étapes de la spec, pas seulement les priorités. **L'étape 1** comprend les Phases 1 à 7 (US1, US2, US3, US5) et se termine par un déploiement en prod. **L'étape 2** comprend la Phase 8 (US4), puis la Phase 9 de finition. L'US5 (P3) passe avant l'US4 (P2) parce qu'elle fait partie de l'étape 1 : sans elle, la démo et l'e2e ne marchent plus une fois la base en place.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (autre fichier, pas de dépendance sur une tâche non finie)
- **[Story]** : user story de la spec (US1 à US5)

## Règles communes à toutes les tâches

- **Versions** : `better-sqlite3` **^12.11** et non 13.x (la 13 exige Node 22, la constitution garde Node 20 en dev) ; `drizzle-orm` ^0.45 ; `drizzle-kit` ^0.31 (dev). Avant d'écrire un appel dont la syntaxe est incertaine (migrateur, `sqliteTable`, mode booléen ou JSON des colonnes, `db.backup()`), le vérifier dans `node_modules/drizzle-orm` ou `node_modules/better-sqlite3/docs/api.md`.
- **Next 16** : lire `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md` avant d'écrire `instrumentation.ts`.
- **Couches** : tout le SQL vit dans `src/store/`. `src/domain/` ne change pas, sauf pour corriger un oubli révélé par une clé étrangère, avec son test. Les commandes ne changent qu'à l'étape 2.
- **Tests** : `node:test` + `tsx` dans `tests/domain/`. Chaque test qui touche le store prend une base dans un `mkdtemp` (`WISHLIST_DATA_PATH=<dir>/wishlist.json`) et appelle `closeStore()` avant de supprimer le dossier. Jamais `data/wishlist.json` ni `data/wishlist.db`.
- **Données** : comptes `@example.test` seulement. Les messages d'import et de `db:check` citent des collections et des identifiants, jamais un e-mail, un nom ni un jeton.
- **Commandes** : `npm run lint && npm run typecheck && npm test`.
- **Commits** : en français, préfixés `feat:`, `fix:` ou `chore:`. Un commit à la fin de l'étape 1 (avant le déploiement), un autre à la fin de l'étape 2.

---

## Phase 1: Setup

- [X] T001 Installer les dépendances à la racine : `npm install better-sqlite3@^12.11 drizzle-orm@^0.45` et `npm install -D drizzle-kit@^0.31 @types/better-sqlite3`. Vérifier que `package.json` garde `"engines": { "node": ">=20.9" }`.
- [X] T002 [P] Créer `drizzle.config.ts` à la racine (`dialect: "sqlite"`, `schema: "./src/store/schema.ts"`, `out: "./drizzle"`) et ajouter à `package.json` les scripts `"db:generate": "drizzle-kit generate"`, `"db:check": "node --import tsx scripts/db-check.ts"` et `"bench:store": "node --import tsx scripts/bench-store.ts"`.
- [X] T003 [P] Ajouter `data/*.db`, `data/*.db-wal`, `data/*.db-shm` et `*.db-journal` à `.gitignore`, à côté de `data/wishlist.json` (principe I, R9).

---

## Phase 2: Foundational (bloquant)

**But** : la base existe, et `readDocument`, `getDocument` et `updateDocument` marchent dessus avec la même signature (FR-006). L'import de l'ancien fichier vient en Phase 3.

### Tests (écrits avant, ils doivent échouer)

- [X] T004 [P] Écrire `tests/domain/store-rows.test.ts` : pour chaque collection de `apiDoc()` (`tests/domain/helpers/api-fixtures.ts`) et de la base de démo construite comme dans `scripts/create-demo-data.mjs`, `fromRow(toRow(x))` est égal à `x` (`deepStrictEqual`). Couvrir `theme` (objet), `typeIds` (tableau, y compris vide), les booléens (`mustChangePassword`, `fromTemplate`, `pinned`, `archived`), les `null` (`subtitle`, `coverImageUrl`, `readPasswordHash`, `url`, `imageUrl`, `priceCents`, `priority`, `personId` d'une vue, `fromName`, `note`, `userId` d'une réservation), un texte avec emoji et accents, un prix en centimes.
- [X] T005 [P] Écrire `tests/domain/store-write.test.ts` sur une base temporaire :
  - `replaceDocument(apiDoc())` puis `readDocument()` rend `apiDoc()` à l'identique, dans le même ordre ;
  - `updateDocument` qui modifie `doc` en place, et un autre qui rend un nouvel objet : les deux sont enregistrés ;
  - une seule réservation ajoutée n'écrit qu'une ligne (compter les changements avec `db.prepare("select total_changes()")` ou un espion sur le différentiel) ;
  - un `mutate` qui lève : rien n'est écrit et l'erreur remonte ;
  - une violation de clé étrangère (idée vers une liste absente) : rejet au `COMMIT`, rien n'est écrit ;
  - ordre : trois idées ajoutées par trois `updateDocument` successifs sortent dans l'ordre d'ajout, et une idée modifiée garde sa place ;
  - une lecture pendant un `updateDocument` dont le `mutate` attend (`await` d'une promesse qu'on résout plus tard) voit l'état d'avant et ne bloque pas (FR-009) ;
  - droits : `wishlist.db`, `-wal` et `-shm` ont le mode `600` (test ignoré sous Windows).

### Implémentation

- [X] T006 Écrire `src/store/schema.ts` : tables Drizzle exactement comme dans [data-model.md](data-model.md), noms de colonnes en `snake_case` :
  - `users` : « `email` NOT NULL, UNIQUE », « `must_change_password` NOT NULL, défaut 0 », « `session_version` NOT NULL, défaut 0 » ;
  - `wishlists` : « `read_token` NOT NULL, UNIQUE », « `invite_token` NOT NULL, UNIQUE », `theme` en texte JSON ;
  - `memberships` : « PK composée (`wishlist_id`, `user_id`) », « Index sur `user_id` », « `role` NOT NULL, `owner` ou `member` » ;
  - `types`, `people`, `views`, `items`, `reservations` : `wishlist_id` NOT NULL, FK → `wishlists.id`, index ;
  - `views` : « `kind` NOT NULL, `all`, `types` ou `person` », `type_ids` en texte JSON NOT NULL, « `person_id` NULL, FK → `people.id` » ;
  - `items` : « `type_id` NOT NULL, FK → `types.id` », « `person_id` NOT NULL, FK → `people.id` », « `archived` NOT NULL, défaut 0 » ;
  - `reservations` : « `item_id` NOT NULL, FK → `items.id`, **UNIQUE** », « `user_id` NULL, FK → `users.id` » ;
  - `password_resets`, `api_sessions` : « `token_hash` NOT NULL, UNIQUE », « `user_id` NOT NULL, FK → `users.id`, index » ;
  - `meta` (`key` PK, `value` NOT NULL).
  
  **Pas de `ON DELETE CASCADE`** (le domaine supprime lui-même les lignes liées).
- [X] T007 Générer la première migration avec `npm run db:generate` dans `drizzle/` et la relire : contraintes, index uniques, clés étrangères sans cascade. La versionner.
- [X] T008 [P] Écrire `src/store/rows.ts` : pour chaque collection, la clé primaire, `toRow(obj)` et `fromRow(row)` (booléens, `theme` et `typeIds` sérialisés en JSON, `null` conservés). Exporter une table de correspondance `COLLECTIONS` (nom de collection de `Database` → table, clé, conversions) dans l'ordre de `Database`.
- [X] T009 [P] Écrire `src/store/diff.ts` : `writeDiff(tx, before: Database, after: Database, collections = COLLECTIONS)`. Pour chaque collection, comparer par clé primaire : ligne nouvelle → `INSERT`, ligne absente → `DELETE`, ligne présente avec une sérialisation différente → `UPDATE`. Jamais `INSERT OR REPLACE`, qui change le `rowid` (R5, R6).
- [X] T010 Écrire `src/store/connection.ts` (R4, R9) :
  - `openStore(path?)` est mis en cache par chemin, sur `globalThis` pour survivre au rechargement de `next dev`. Il crée le dossier et le fichier `.db` en mode `0600`, puis ouvre deux connexions `better-sqlite3`, `writer` et `reader` ;
  - pragmas : `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`, `busy_timeout = 5000` ;
  - il applique les migrations de `drizzle/` (dossier résolu depuis `process.cwd()`), puis `chmod 0600` sur `.db`, `-wal`, `-shm` (échec ignoré) ;
  - `closeStore(path?)` ferme les connexions et vide le cache ;
  - `databaseFilePath()` vaut `dataFilePath()` avec `.json` remplacé par `.db`, ou le chemin tel quel s'il finit déjà par `.db` (R2).
  
  Laisser un point d'appel vide pour l'import (T015).
- [X] T011 Réécrire `src/store/db.ts` selon [contracts/store.md](contracts/store.md) :
  - `dataFilePath()` reste inchangé ; `databaseFilePath()` est réexporté depuis `connection.ts` ;
  - `readDocument()` lit toutes les tables sur `reader`, dans une transaction de lecture, en un seul tour synchrone, avec `ORDER BY rowid` ;
  - `getDocument = cache(readDocument)` reste inchangé ;
  - `updateDocument(mutate)` met l'appel dans une file en mémoire par chemin (promesse chaînée), puis fait `BEGIN IMMEDIATE` sur `writer` et `PRAGMA defer_foreign_keys = ON`. Il lit le document, garde `before = structuredClone(doc)`, attend `mutate(doc)`, appelle `writeDiff(before, next)` puis `COMMIT`. En cas d'erreur : `ROLLBACK` et l'erreur remonte ;
  - `replaceDocument(doc)` est nouveau : même transaction, `DELETE` de toutes les tables puis `INSERT` dans l'ordre des tableaux.
  
  Retirer `ensureFile`, `writeFile` et `rename`. `normalizeDocument` part dans `src/store/legacy-json.ts` en T014. Faire passer T004 et T005.

**Checkpoint** : le store marche sur une base vide et sur `replaceDocument`. Les tests existants qui écrivent le JSON à la main échouent encore (Phase 4).

---

## Phase 3: User Story 1 - Mettre à jour le serveur sans perdre une donnée (Priority: P1) 🎯 MVP

**Goal** : au premier démarrage, l'ancien fichier est importé, tout ou rien, et l'application sert ensuite depuis la base. Les comptes restent connectés et les liens marchent (FR-001 à FR-005).

**Independent Test** : [quickstart.md](quickstart.md), US1. Démarrer l'ancienne version, puis la nouvelle sur le même volume : les nombres sont identiques, aucune reconnexion n'est demandée et les liens marchent.

### Tests

- [X] T012 [P] [US1] Écrire `tests/domain/store-import.test.ts` :
  - **Fidélité** : écrire `apiDoc()` en JSON dans `<dir>/wishlist.json`, ouvrir le store. `readDocument()` égale `apiDoc()` (identifiants, `passwordHash`, jetons, dates et ordre compris) et `meta.legacy_import` commence par `imported:`.
  - **Normalisation** : reprendre le document « ancien » du test actuel de `tests/domain/api-session.test.ts` (l. 75 : `apiSessions`, `passwordResets`, `sessionVersion`, `mustChangePassword`, `subtitle`, `coverImageUrl`, `readPasswordHash`, `imageUrl`, `archived`, `reservation.userId` absents ; tous les `sortOrder` des libellés à 0). Après l'import, les valeurs par défaut sont celles de [data-model.md](data-model.md), « Normalisation à l'import ».
  - **Pas de réimport** : fermer le store, modifier le JSON, rouvrir. La base n'a pas changé et le JSON non plus (même contenu, même `mtime`).
  - **Installation neuve** : aucun JSON. La base est vide et `meta.legacy_import` vaut `none`.
  - **Refus** : JSON invalide, puis collection `items` absente. `openStore` lève `LegacyImportError`, et ni `wishlist.db` ni ses fichiers annexes ne restent ; le JSON n'a pas changé.
  - **Contrôles d'intégrité**, un cas par point de [data-model.md](data-model.md), « Contrôle d'intégrité » : identifiant en double, adhésion en double, e-mail en double, `readToken` en double, deux réservations pour une idée, idée vers une liste absente, `view.typeIds` vers un libellé absent. Chaque refus nomme la collection et l'identifiant, et le message ne contient ni l'e-mail ni le nom des fixtures.
  - **Tout ou rien** : simuler un échec au milieu des insertions (espion qui lève après la 3ᵉ table). Rien n'est gardé, et la réouverture suivante refait l'import complet sans doublon.
  - **Un seul import** : deux processus (`child_process.fork` d'un petit script `tests/domain/helpers/open-store.ts`) ouvrent la même base neuve en même temps. Une seule ligne `legacy_import` est écrite, et les nombres sont ceux du JSON.
  - **Sessions expirées** : une `ApiSession` et une `PasswordReset` expirées importées restent refusées par `findApiSessionUser` et par la réinitialisation.

### Implémentation

- [X] T013 [US1] Déplacer `normalizeDocument` de `src/store/db.ts` vers `src/store/legacy-json.ts` sans en changer le contenu.
- [X] T014 [US1] Dans `src/store/legacy-json.ts`, ajouter :
  - `class LegacyImportError extends Error { problems: string[] }` ;
  - `checkDocument(doc): string[]`, avec les cinq contrôles de [data-model.md](data-model.md), « Contrôle d'intégrité ». Une ligne par problème, par exemple `items: gift-3 → wishlistId absent (w-9)`, `users: 2 comptes avec le même e-mail (alex, alex-2)` ;
  - `loadLegacyDocument(file): Database`, qui lit le fichier, le décode, vérifie les collections obligatoires, normalise, contrôle et lève `LegacyImportError` en cas de problème. Il ne touche jamais au fichier.
- [X] T015 [US1] Brancher l'import dans `openStore` (`src/store/connection.ts`, R7). Après les migrations, si `meta.legacy_import` manque, ouvrir `BEGIN IMMEDIATE` et relire la clé :
  - toujours absente et `dataFilePath()` existe : `loadLegacyDocument`, insertion dans l'ordre des tableaux, `legacy_import = imported:<ISO>`, `COMMIT` ;
  - toujours absente sans fichier : `legacy_import = none` ;
  - en cas d'erreur : `ROLLBACK`, puis fermer et supprimer `.db`, `-wal` et `-shm` **seulement si la base vient d'être créée par cet appel**, et relever l'erreur.
  
  Écrire dans le journal une ligne `[store] ancien fichier importé : N comptes, N listes, N idées, N réservations` (des nombres, aucune donnée). Faire passer T012.
- [X] T016 [US1] Créer `instrumentation.ts` à la racine (R8). `export async function register()` ne fait rien si `process.env.NEXT_RUNTIME !== "nodejs"`. Sinon il importe `./src/store/connection` dynamiquement et appelle `openStore()`. En cas d'échec : `console.error` du message et de `problems`, puis `process.exit(1)`.
- [X] T017 [P] [US1] Écrire `scripts/db-check.ts` (`npm run db:check -- <fichier> [--counts]`), qui ne fait aucune écriture :
  - sur un `.json` : `loadLegacyDocument`, puis affiche « aucun problème » ou la liste des problèmes et sort avec le code 1 ;
  - sur un `.db` : ouverture en lecture seule (`readonly: true`, sans migration ni import), puis `checkDocument` sur son contenu ;
  - `--counts` : nombre d'enregistrements par collection, dans les deux cas.
- [X] T018 [US1] Dérouler [quickstart.md](quickstart.md), US1, étapes 1 à 8 et cas limites, avec la version de `main` d'avant la feature pour les étapes 1 à 3 (`git worktree add ../whishlist-prev main`).

**Checkpoint** : une base existante est importée sans perte. Le site et l'app marchent, aucune reconnexion n'est demandée.

---

## Phase 4: User Story 2 - Tout continue de marcher (Priority: P1)

**Goal** : aucun comportement ne change. Chaque écriture est atomique, et deux personnes ne peuvent toujours pas confirmer la même idée (FR-007, FR-008, FR-019).

**Independent Test** : [quickstart.md](quickstart.md), US2. Tous les tests existants passent sans changer leurs attentes, et une double réservation n'en garde qu'une.

### Tests

- [X] T019 [P] [US2] Écrire `tests/domain/store-concurrency.test.ts` :
  - 100 `reserveItem` simultanés sur la même idée libre, via la commande de `src/server/commands/public-list.ts` et `Promise.all` : exactement un `ok`, 99 refus avec l'erreur que la commande rend déjà, une seule ligne dans `reservations` (SC-004) ;
  - le même scénario sur **deux processus** (`child_process.fork` de `tests/domain/helpers/reserve-worker.ts`, 50 essais chacun) : une seule réservation au total ;
  - deux `updateDocument` concurrents sur deux listes différentes : les deux écritures sont gardées, aucune n'est perdue.

### Implémentation

- [X] T020 [US2] Adapter `withStore` dans `tests/domain/helpers/api-fixtures.ts` : `replaceDocument(doc)` au lieu de `writeFile`, et `closeStore()` dans le `finally` avant le `rm`. Ne changer aucune attente des tests qui l'utilisent.
- [X] T021 [P] [US2] Adapter les tests qui lisent ou écrivent le JSON à la main, sans changer leurs attentes :
  - `tests/domain/commands-items.test.ts` (l. 81 et 92) : comparer `await readDocument()` avant et après, au lieu de relire le fichier ;
  - `tests/domain/commands-public-list.test.ts` (l. 119-120) : `replaceDocument(doc)` au lieu de `writeFile` ;
  - `tests/domain/api-session.test.ts` (l. 75) : le cas « document ancien » passe par l'import (écrire le JSON **avant** la première ouverture, dans un dossier neuf), ou il est déplacé dans T012 s'il ne teste que la normalisation ;
  - `tests/domain/accounts.test.ts` et `tests/domain/reserve.test.ts` : ajouter `closeStore()` avant `rm` dans chaque `finally`.
- [X] T022 [US2] Lancer `npm test`. Pour chaque échec dû à une clé étrangère au `COMMIT` (ligne liée oubliée par le domaine, par exemple une réservation qui reste après la suppression de son idée), corriger la fonction de `src/domain/` concernée et ajouter le cas au test de domaine correspondant. Ne jamais retirer la clé étrangère. Noter chaque correction dans « Écarts à l'implémentation » en bas de ce fichier.
- [X] T023 [US2] Supprimer `src/store/file.ts`, puis `proper-lockfile` et `@types/proper-lockfile` de `package.json` (`npm uninstall`). Vérifier avec `grep -rn "proper-lockfile\|withFileLock" src scripts tests` qu'il n'en reste aucune trace.
- [X] T024 [US2] Image Docker (`Dockerfile`) : copier `drizzle/` dans l'étape `runner` (`COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle`). Lancer `docker build -t whishlist:local .` et démarrer l'image sur un volume qui contient une copie de la base de démo en JSON. Vérifier que l'import se fait, que `better-sqlite3` se charge (binaire `linux-arm64`) et que l'utilisateur `1000:1000` de `deploy/compose.prod.yml` crée `wishlist.db` dans `/data`. Si le binaire précompilé manque, ajouter `apt-get install -y --no-install-recommends python3 make g++` à l'étape `deps` seulement.

**Checkpoint** : `npm run lint && npm run typecheck && npm test` passent ; l'image Docker démarre et importe.

---

## Phase 5: User Story 3 - Sauvegarder et restaurer le serveur (Priority: P2)

**Goal** : sauvegarde cohérente pendant que le serveur tourne, restauration, retour à la version précédente, le tout documenté (FR-015, SC-006).

**Independent Test** : [quickstart.md](quickstart.md), US3. Sauvegarder pendant des réservations, restaurer sur un volume neuf, vérifier les données.

- [X] T025 [P] [US3] Écrire `scripts/db-backup.mjs <destination>`, en JS simple (sans `tsx`) pour tourner dans l'image :
  - il ouvre la base de `WISHLIST_DATA_PATH` avec `better-sqlite3` (même règle de chemin que `databaseFilePath`, réécrite en quelques lignes) et appelle `await db.backup(destination)` ;
  - il met la destination en mode `0600` et affiche le chemin et la taille ;
  - si la base n'existe pas, il sort avec le code 1.
  
  Ajouter à `Dockerfile`, étape `runner` : `COPY --from=builder --chown=nextjs:nodejs /app/scripts/db-backup.mjs ./scripts/db-backup.mjs`.
- [X] T026 [P] [US3] Ajouter `tests/domain/store-backup.test.ts`. Pendant qu'une boucle d'`updateDocument` ajoute des idées, lancer `scripts/db-backup.mjs` (`spawnSync`) vers un autre dossier. La sauvegarde s'ouvre, `PRAGMA integrity_check` vaut `ok`, et son contenu est un état valide (`checkDocument` vide).
- [X] T027 [US3] Adapter `deploy/backup-whishlist.sh` (R10) :
  - `SRC` est remplacé par `docker exec whishlist node scripts/db-backup.mjs /data/.backup-$STAMP.db` ;
  - le fichier `$DATA_DIR/.backup-$STAMP.db` est chiffré (même commande `openssl`) en `wishlist-$STAMP.db.enc`, ou copié en `wishlist-$STAMP.db`, puis supprimé du volume (`trap` pour le supprimer aussi en cas d'erreur) ;
  - la rétention couvre `wishlist-*.json`, `wishlist-*.json.enc`, `wishlist-*.db` et `wishlist-*.db.enc`.
  
  Mettre à jour le commentaire d'en-tête.
- [X] T028 [P] [US3] Adapter `deploy/harden-data.sh` (`chmod 600` sur `wishlist.json`, `wishlist.db`, `wishlist.db-wal`, `wishlist.db-shm` s'ils existent) et `deploy/ops-check.sh` (exiger `wishlist.db` au lieu de `wishlist.json`, vérifier son mode `600`).
- [X] T029 [US3] Documenter dans `deploy/DEPLOY-RUNTIPI.md` (sections « Permissions data », « Backup chiffré », « Restauration ») et dans `README.md` (section persistance) :
  - **mise à jour depuis l'ancien fichier** : copie de `wishlist.json` hors du volume, `npm run db:check -- <copie>`, build, redémarrage, lecture des journaux ;
  - **sauvegarde à chaud** : le cron existant, ou `docker exec whishlist node scripts/db-backup.mjs …` à la main ;
  - **restauration** : arrêter le conteneur, déchiffrer vers `wishlist.db`, supprimer `wishlist.db-wal` et `wishlist.db-shm`, `chmod 600`, redémarrer ;
  - **retour à la version précédente** : image précédente et `wishlist.json` d'origine resté intact, en prévenant clairement que les changements faits depuis la mise à jour sont perdus.
  
  Dans le tableau des variables du `README.md`, la ligne `WISHLIST_DATA_PATH` devient « Chemin de l'ancien JSON, importé une fois ; la base est à côté, en `.db` » (aucune nouvelle variable, R2 ; `.env.example` et `deploy/compose.prod.yml` restent inchangés).
- [X] T030 [US3] Dérouler [quickstart.md](quickstart.md), US3, étapes 1 à 3, en local puis avec l'image Docker, et chronométrer (SC-006).

**Checkpoint** : sauvegarde et restauration vérifiées, doc à jour.

---

## Phase 6: User Story 5 - Développer et faire des démos comme avant (Priority: P3, étape 1)

**Goal** : base de démo, captures, e2e et tests marchent sur la base, avec les mêmes commandes (FR-016, FR-018).

**Independent Test** : [quickstart.md](quickstart.md), US5. Suivre le guide des agents depuis un clone neuf.

- [X] T031 [US5] Adapter `scripts/create-demo-data.mjs` (R11). Le document construit est enregistré par `replaceDocument` (import dynamique de `src/store/db.ts`) dans la base dérivée de l'argument : `process.env.WISHLIST_DATA_PATH = path.resolve(outputArg)` avant l'import, puis `closeStore()`. Il n'écrit plus de JSON. Le message d'usage devient `npm run demo:data -- <chemin, comme WISHLIST_DATA_PATH>`. `tests/domain/demo-seed.test.ts` doit toujours passer.
- [X] T032 [P] [US5] Écrire `scripts/db-sessions.ts <WISHLIST_DATA_PATH> <userId>` : il ouvre la base en lecture seule et affiche le nombre de lignes `api_sessions` du compte. Sortie : un nombre seul.
- [X] T033 [US5] Adapter `mobile/scripts/e2e.mjs` :
  - `resetDatabase()` lance `scripts/create-demo-data.mjs` directement sur `tmp/e2e/wishlist.json`. Le remplacement se fait dans une transaction pendant que le serveur tourne, donc il n'y a plus de fichier `.next` à renommer : mettre à jour le commentaire ;
  - `checkServer()` remplace la lecture de `apiSessions` dans le JSON par `spawnSync("node", ["--import", "tsx", "scripts/db-sessions.ts", "tmp/e2e/wishlist.json", "demo-owner"])` depuis la racine du dépôt ;
  - mettre à jour le commentaire « R3 ».
  
  Vérifier que `npm --prefix mobile test` passe toujours (les tests de `mobile/__tests__/e2e/` qui portent sur le runner).
- [X] T034 [P] [US5] Vérifier `scripts/backfill-og.ts` : il passe par `updateDocument`, qui marche sur la base. Ajouter `closeStore()` à la fin. `scripts/capture-demo.mjs` ne lit que le serveur : rien à changer (le vérifier).
- [X] T035 [US5] Mettre à jour `AGENTS.md` :
  - **Commandes** : `demo:data` écrit la base ; ajouter `npm run db:check -- <fichier>`, `npm run db:generate` (après un changement de `src/store/schema.ts`) et `node scripts/db-backup.mjs <destination>` ;
  - **Couches** : « `src/store/db.ts` : seul accès au fichier JSON… » devient « `src/store/` : seul accès à la base SQLite. Une écriture passe par `updateDocument` (une transaction), jamais par une requête directe hors de `src/store/` » ;
  - **Tests** : « un test qui touche le store travaille sur une base temporaire (`mkdtemp`) et appelle `closeStore()` » ;
  - **Fichiers générés** : ajouter `drizzle/meta/` (écrit par `db:generate`).
  
  Mettre aussi à jour `mobile/.maestro/README.md` si une commande de remise à zéro y est décrite.
- [X] T036 [US5] Dérouler [quickstart.md](quickstart.md), US5, étapes 1 à 4 (clone neuf : `git clone . ../whishlist-clone`).

**Checkpoint** : démo, captures, e2e et tests marchent sur la base.

---

## Phase 7: Fin de l'étape 1 — vérification et déploiement

- [X] T037 Dérouler [quickstart.md](quickstart.md), US2, étapes 1 à 5 : lint, types et tests du site et de l'app, suite e2e Maestro complète sur iOS (résumé identique à celui d'avant la feature), parcours manuels des quickstarts 005 et 006 (export des données, suppression d'un compte membre d'une liste partagée), double réservation dans deux fenêtres.
- [ ] T038 Lancer `npm run build` et la revue de code de l'étape 1. Proposer le commit `feat: base SQLite (WAL, Drizzle) à la place du fichier JSON, import automatique au démarrage`, et attendre l'accord avant de le créer.
- [ ] T039 Préparer le déploiement en prod ([quickstart.md](quickstart.md), section « Déploiement en prod ») : donner les commandes exactes (copie de `wishlist.json`, `db:check`, build, redémarrage, vérification des journaux, `ops-check.sh`, un premier `backup-whishlist.sh` à la main) **sans les lancer**. Le déploiement est fait par la personne qui exploite le serveur. Attendre sa confirmation que l'étape 1 tourne en prod avant de commencer la Phase 8.

**Checkpoint** : l'étape 1 tourne en prod.

---

## Phase 8: User Story 4 - Rester rapide quand la base grandit (Priority: P2, étape 2)

**Goal** : les commandes, l'authentification et les pages ne lisent et n'écrivent que leur portée (FR-011 à FR-014, SC-005).

**Independent Test** : [quickstart.md](quickstart.md), US4. `bench:store` avant/après, lint sans `no-restricted-imports`, test d'équivalence vert.

### Mesure de référence et tests

- [ ] T040 [P] [US4] Écrire `scripts/bench-store.ts` (R14) et remettre dans `package.json` le script `"bench:store": "node --import tsx scripts/bench-store.ts"` (retiré à la revue de l'étape 1) :
  - générer dans `tmp/bench/` une base de démo normale et une base agrandie d'au moins 100 fois sa taille : comptes `<n>@example.test`, listes, idées et réservations fictives ; construire le document en mémoire, puis `replaceDocument` ;
  - mesurer sur chaque base, en appelant les commandes de `src/server/commands/` avec un `CommandContext` de test : lecture d'une liste par son membre (commande utilisée par `GET /api/v1/lists/{id}`), lecture publique par `readToken`, réservation, et la suite d'appels de l'app à la synchronisation (listes du compte, puis une liste) ;
  - afficher la médiane de 50 essais par mesure, et le rapport base agrandie / base normale.
  
  Lancer le script sur l'étape 1 et noter les chiffres dans « Écarts à l'implémentation ».
- [ ] T041 [US4] Écrire `tests/domain/store-scopes.test.ts`, le test d'équivalence (R13). Pour chaque commande exportée par `src/server/commands/*.ts` et pour `resetPasswordAction` :
  - préparer `apiDoc()`, enrichi d'une deuxième liste dont le compte n'est pas membre et d'une session d'un autre compte ;
  - jouer la commande une fois sur la version étape 1 (accès à tout le document, conservée dans le test par un drapeau `STORE_FULL_DOCUMENT=1` lu par `src/store/scopes.ts`) et une fois sur la portée ;
  - comparer le résultat rendu, puis `readDocument()` après l'appel.
  
  Couvrir aussi les refus : compte inactif, non-membre, liste publique protégée par mot de passe, limite de débit.

### Implémentation

- [ ] T042 [US4] Écrire `src/store/scopes.ts` selon [contracts/store.md](contracts/store.md) : le type `Scope`, puis `readScope(scope | scope[])`, `getScope` (`cache` de React, clé = `JSON.stringify(scope)`) et `updateScope(scope | scope[], mutate, { onConflict })`.
  - Les requêtes ciblées par portée suivent [data-model.md](data-model.md), « Portées de l'étape 2 », avec `ORDER BY rowid`.
  - `updateScope` passe par la même file et le même `BEGIN IMMEDIATE` que `updateDocument`, relit la portée **dans** la transaction, et n'applique `writeDiff` qu'aux lignes chargées. Une ligne absente de `before` qui apparaît dans `after` est un `INSERT`, une ligne de `before` absente de `after` un `DELETE`, et aucune autre ligne n'est touchée.
  - Une erreur `SQLITE_CONSTRAINT_UNIQUE` sur `users.email`, `reservations.item_id` ou un jeton est passée à `onConflict`.
  
  Ajouter des tests de portée dans `tests/domain/store-scopes.test.ts` : contenu exact de chaque portée sur la fixture, et absence de toute ligne d'une autre liste ou d'un autre compte.
- [ ] T043 [US4] Passer `src/server/commands/public-list.ts` aux portées (`listByReadToken`). Pour la réservation, `onConflict("reservationItem")` rend l'erreur que la commande rend déjà quand l'idée est prise. Faire passer son cas de T041, `tests/domain/commands-public-list.test.ts` et T019.
- [ ] T044 [P] [US4] Passer `src/server/commands/items.ts` et `src/server/commands/labels.ts` à la portée `list`. Faire passer leurs cas de T041 et leurs tests.
- [ ] T045 [P] [US4] Passer `src/server/commands/lists.ts` aux portées `list` et `user` (création : la nouvelle liste est ajoutée dans la portée `user` du créateur). Faire passer ses cas de T041.
- [ ] T046 [P] [US4] Passer `src/server/commands/sharing.ts` à `[listByInviteToken, user]` pour rejoindre une liste, et à `list` pour le reste. Faire passer ses cas de T041 et `tests/domain/commands-sharing.test.ts`.
- [ ] T047 [P] [US4] Passer `src/server/commands/auth.ts` aux portées suivantes :
  - `userByEmail` pour la connexion, l'inscription et le mot de passe oublié, avec `onConflict("email")` → `emailTaken` pour l'inscription ;
  - `apiSession` pour la vérification et la déconnexion d'un jeton ;
  - `account` pour le changement de mot de passe.
  
  Passer aussi `src/server/api/auth.ts` (`readDocument` → `readScope({ kind: "apiSession", tokenHash })`). Le test « deux inscriptions simultanées » de `tests/domain/accounts.test.ts` doit passer par la commande.
- [ ] T048 [P] [US4] Passer `src/server/commands/account.ts` (export, aperçu, suppression) à la portée `account`. Vérifier que la suppression d'un compte met à `null` le `userId` de ses réservations sur des listes dont il n'est pas membre, ce qui exige que la portée les contienne. Faire passer `tests/domain/commands-account.test.ts`.
- [ ] T049 [US4] Passer `src/server/actions.ts` aux portées : `resetPasswordAction` sur `passwordReset`, et toute autre lecture ou écriture directe du store. Passer `src/auth/current.ts` à `getScope({ kind: "user", userId })`.
- [ ] T050 [US4] Passer les 8 pages à `getScope`, en reprenant pour chacune la portée de la commande équivalente :
  - `app/page.tsx` et `app/compte/page.tsx` : `user` ou `account` ;
  - `app/listes/[id]/page.tsx` : `list` ;
  - `app/l/[readToken]/page.tsx`, `app/l/[readToken]/types/page.tsx` et `app/l/[readToken]/reserver/page.tsx` : `listByReadToken` ;
  - `app/inviter/[token]/page.tsx` : `listByInviteToken` ;
  - `app/reinitialiser/[token]/page.tsx` : `passwordReset`.
  
  Vérifier chaque page à la main sur la base de démo.
- [ ] T051 [US4] Dans `eslint.config.mjs`, ajouter `no-restricted-imports` sur `app/**` et `src/server/**`. Il interdit `readDocument`, `getDocument`, `updateDocument` et `replaceDocument` venant de `src/store/db` (`importNames`), avec le message « Utiliser une portée de src/store/scopes.ts (FR-014) ». Puis retirer de `src/store/scopes.ts` le drapeau `STORE_FULL_DOCUMENT` de T041 : le test d'équivalence compare alors à un résultat attendu écrit dans le test, relevé avant le retrait. `npm run lint` passe.
- [ ] T052 [US4] Mettre à jour `AGENTS.md`, section **Couches**. Une commande lit par `getScope`/`readScope` et écrit par `updateScope`, avec la plus petite portée qui contient ce que lisent ses fonctions du domaine (tableau de [contracts/store.md](contracts/store.md)) ; une nouvelle commande ajoute son cas au test d'équivalence. `readDocument`/`updateDocument` sont réservés aux scripts, à l'import et aux tests.
- [ ] T053 [US4] Relancer `npm run bench:store` et comparer aux chiffres de T040 : pour chaque mesure sur la base agrandie, au plus deux fois la base normale (SC-005). Si une mesure dépasse, chercher l'index manquant ou la portée trop large avant de toucher à autre chose. Noter les chiffres dans « Écarts à l'implémentation ».

**Checkpoint** : plus aucun accès à tout le document dans `app/` ni `src/server/`. Équivalence, tests et bench passent.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T054 Dérouler [quickstart.md](quickstart.md), US4, étapes 1 à 4, puis à nouveau US2, étapes 3 à 5 (e2e, parcours manuels, double réservation), sur l'étape 2.
- [ ] T055 [P] Relire `README.md`, `AGENTS.md`, `deploy/DEPLOY-RUNTIPI.md` et `mobile/.maestro/README.md` : plus aucune mention d'un fichier JSON comme stockage courant, à part l'import et le retour arrière.
- [ ] T056 Lancer `npm run build`. La revue de code (`wishlist-feature-review`) est lancée par le hook `after_implement`. Proposer ensuite le commit `feat: requêtes ciblées par portée dans les commandes et les pages` avec `review.md`, et attendre l'accord avant de le créer. Le déploiement de l'étape 2 suit la même procédure que T039.

---

## Écarts à l'implémentation

### Étape 1

- **Pas de `toRow`/`fromRow` (T008)** : les propriétés du schéma Drizzle portent les noms des champs du domaine (`passwordHash: text("password_hash")`), Drizzle convertit booléens et JSON. `src/store/rows.ts` ne garde que `COLLECTIONS`, `sameRow` et `readAll`. T004 vérifie donc l'aller-retour par la base (`replaceDocument` puis `readDocument`) au lieu d'une conversion en mémoire.
- **Migrations appliquées par le store, pas par le migrateur de Drizzle (T010)** : `migrate()` de `drizzle-orm/better-sqlite3` lit la dernière migration appliquée hors de sa transaction. Deux processus qui ouvrent une base neuve pourraient l'appliquer deux fois. `migrateAndImport` (`src/store/connection.ts`) lit les mêmes fichiers (`readMigrationFiles`) et tient la même table `__drizzle_migrations`, mais dans un `BEGIN IMMEDIATE` qui couvre aussi l'import.
- **`src/store/startup.ts` (T016)** : `instrumentation.ts` importe un module qui contient `process.exit`, sinon le build avertit d'une API Node vue par le runtime Edge (même découpage que la doc Next).
- **`/*turbopackIgnore: true*/`** sur les accès `fs` à chemin dynamique de `connection.ts` : sans eux, le build tente de tracer tout le projet (16 616 fichiers).
- **`package-lock.json` régénéré avec le npm de l'image (10.9)** : l'installation locale (npm 11.6) avait retiré des entrées optionnelles `@emnapi/*` que `npm ci` exige dans `node:22-bookworm-slim`. Le build Docker échouait.
- **Image Docker (T024)** : le binaire précompilé de `better-sqlite3` pour `linux-arm64` est téléchargé, donc pas d'outils de compilation dans l'étape `deps`.
- **Aucune correction du domaine (T022)** : les clés étrangères n'ont révélé aucun oubli. Un seul test avait une fixture incohérente (`commands-client-ids.test.ts` renommait la liste sans renommer ses libellés, personnes et idées) : la préparation est corrigée, l'attente ne change pas.
- **`scripts/backfill-og.ts` (T034)** : contrairement au plan, il ne passait pas par `updateDocument` mais réécrivait le JSON à la main. Il est réécrit : lecture de la base, téléchargements hors transaction, puis une seule écriture qui n'écrase pas une image ajoutée entre-temps.
- **Quickstart US1 (T018)** : un `next dev` tournait déjà dans ce dossier (port 3010) et Next 16 en refuse un second. La nouvelle version a donc tourné en build de production (`next start`, port 3012), ce qui a aussi validé `instrumentation.ts` en production. La version précédente venait d'un worktree de `main`. Les sessions, la réservation et le lien de réinitialisation ont été vérifiés par l'API (`/me`, réservation, page `reinitialiser`), pas dans un navigateur.
- **Quickstart US5 (T036)** : pas de clone neuf, puisque la feature n'est pas commitée. `demo:data`, le remplacement de la base pendant que le serveur tourne, `npm test` sans rien écrire dans `data/` et `npm --prefix mobile test` ont été vérifiés dans l'arbre de travail. `demo:capture` n'a pas été relancé : le script ne lit que le serveur et n'a pas changé.
- **Lint** : `components/site/analytics-opt-out.tsx` (1 erreur `set-state-in-effect`) et `analytics-script.tsx` (1 avertissement) échouaient déjà sur `main`. Ils ne sont pas touchés par cette feature.
- **Corrections de la revue de l'étape 1** ([review.md](review.md)) :
  - **Migration `0000_init` régénérée** : elle porte maintenant les contraintes `CHECK` de `memberships.role` et `views.kind`. Rien n'était commité ni déployé, donc on a régénéré au lieu d'ajouter une `0001`. Les bases locales créées avant ne s'ouvrent plus (« table already exists ») et sont à supprimer : `tmp/**/wishlist.db*`.
  - **Ouverture concurrente** : `busy_timeout` est réglé avant le passage en WAL. Pour ce passage, SQLite répond `SQLITE_BUSY` sans attendre quand un autre processus ouvre la même base neuve, d'où une boucle de réessai limitée au même délai (`enableWal`). Le test à deux processus échouait environ une fois sur quatre ; il passe 25 fois sur 25.
  - **Contrôle de l'ancien fichier** : `checkDocument` est précédé d'un contrôle des champs obligatoires et de leur type (`FIELDS`), avant normalisation. Le message de `JSON.parse` est réduit à sa position (ligne, colonne), parce qu'il recopiait un extrait du fichier.
  - **`scripts/db-sessions.mjs` remplacé par `scripts/db-sessions.ts`**, lancé avec `tsx` et qui passe par `readDatabaseFile` (`src/store/connection.ts`). Seul `scripts/db-backup.mjs` reste hors de `src/store/`, et l'exception est écrite dans `AGENTS.md`.
  - **`bench:store` retiré de `package.json`** jusqu'à T040, qui le remet avec le script.
  - **Variables des scripts de `deploy/`** : un tableau « Scripts d'exploitation » dans le `README.md`. Elles ne vont pas dans `.env.example` ni `deploy/compose.prod.yml` : elles se lisent sur l'hôte, pas dans l'app (règle ajoutée à `AGENTS.md`).

---

## Dependencies & Execution Order

### Phases

- **Setup (Phase 1)** : aucune dépendance.
- **Foundational (Phase 2)** : après la Phase 1 ; bloque tout le reste. T006 → T007 ; T008 et T009 après T006 ; T010 après T007 ; T011 après T008, T009 et T010.
- **US1 (Phase 3)** : après la Phase 2.
- **US2 (Phase 4)** : après la Phase 2. Elle peut avancer en parallèle de l'US1 ; T021 dépend de T012 pour le cas « document ancien ». T024 (Docker) après T015 et T016.
- **US3 (Phase 5)** : après la Phase 2 ; T027 à T030 après T024.
- **US5 (Phase 6)** : après la Phase 2 et T015 ; T033 après T031 et T032.
- **Fin de l'étape 1 (Phase 7)** : après les Phases 3 à 6. T039 (déploiement) bloque la Phase 8.
- **US4 (Phase 8)** : après le déploiement de l'étape 1. T040 et T041 avant T042 ; T043 à T048 après T042 ; T049 après T047 ; T050 après T043 à T049 ; T051 après T050 ; T052 et T053 après T051.
- **Polish (Phase 9)** : après la Phase 8.

### Dans une story

Tests d'abord (ils échouent), puis implémentation, puis parcours du quickstart.

## Parallel Example

```text
# Phase 2, après T006 :
T008 src/store/rows.ts        |  T009 src/store/diff.ts      |  T004, T005 tests

# Phase 3 / Phase 4, une fois la Phase 2 finie :
T012 store-import.test.ts     |  T019 store-concurrency.test.ts  |  T017 scripts/db-check.ts

# Phase 5 :
T025 scripts/db-backup.mjs    |  T028 harden-data.sh, ops-check.sh

# Phase 8, après T042 :
T044 items.ts + labels.ts | T045 lists.ts | T046 sharing.ts | T047 auth.ts | T048 account.ts
```

## Implementation Strategy

### MVP (US1)

Phases 1 à 3 : la base existe et l'ancien fichier est importé sans perte. On s'arrête pour dérouler la quickstart US1 avant de toucher aux tests existants.

### Incrémental

1. **Étape 1** : US1 → US2 → US3 → US5, vérification complète (Phase 7), commit, déploiement en prod.
2. **Étape 2** : US4 commande par commande, chacune avec son cas d'équivalence vert avant de passer à la suivante ; les pages en dernier ; puis la règle ESLint, la mesure et le commit.
