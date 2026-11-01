# Revue de code

Revue complète de l'étape 1 de la feature (Phases 1 à 7, T001–T037), sur le code non commité par rapport à `5145742`. L'étape 2 (US4) n'est pas commencée.

## Fichiers relus

```text
f42a86d73dd19a97b997e9c4cbe1c19780e6040f  .dockerignore
451202dbfe64033180a258915248298d75b9cc55  .gitignore
b2b6475faad3e2ac23c1a0837d4dcc6b3f58c48b  deploy/backup-whishlist.sh
4ed2f1497edf7bcf213ae7d7932ba4f9f07f9b61  deploy/harden-data.sh
9b5fb89f8cab9e2c1bde71ed8125c9501eaa1478  deploy/ops-check.sh
15658f714c48f816246f2de972f0f55c508aba6f  Dockerfile
a28adb024b6af68d38798cd9aa35bc5dd575eec5  drizzle.config.ts
555ca4fa52d9362c2d84137220a4d4a4313d6a6a  drizzle/0000_init.sql
05d8304cc6bcb9dae8537cf74319ab0e11485911  instrumentation.ts
a1888c8543fb447b49df33946331fdcbfa687082  mobile/scripts/e2e.mjs
bb8a5515c0799cae1a2f966f6d11490b888ada2c  package.json
6930302e77516cf27a241dd0a0d54f450ca1d056  scripts/backfill-og.ts
057321dc72f4d590fe79d8411ea50eaab3eb0452  scripts/create-demo-data.mjs
df6c816dddcca742fa9cfdecde9ea8096ea20034  scripts/db-backup.mjs
026f6741f96c0da5426b21e27b7701c7066a5c0b  scripts/db-check.ts
f47dded82e082a46d8c7060f9d839de16b5402a5  scripts/db-sessions.ts
15428c8d5f70f823424aabae948623cac8e5a151  src/store/connection.ts
455eb022d2b55e2668ea3a673e1aa526bcca423f  src/store/db.ts
80293527e1af6508af4c2ffbd1f8df37d47b92e6  src/store/diff.ts
abc69939724d4bd67e00521de41f43ddde5efb90  src/store/legacy-json.ts
a9140046fd510a510cae3fe586b62feb0799f258  src/store/rows.ts
dfdd9141411d40ab6bc118018e2329296f4a7925  src/store/schema.ts
265366f0ced0a07df0ea2321086371ad5516fb19  src/store/startup.ts
b1c33073d4e5a077e1901dccc04e4874ea0a35d1  tests/domain/accounts.test.ts
fa6db140c85921648a464fee17809529cd2116d4  tests/domain/api-session.test.ts
0144ae27abbdb00b97757d7ccafd3e4fe44d604e  tests/domain/commands-client-ids.test.ts
17e18d17d799cd0879e81457e8a4d23a34aecac0  tests/domain/commands-items.test.ts
f2470a440254807d58bfef54d589bddb07a1f9f6  tests/domain/commands-public-list.test.ts
4320f4c352766134a3f27067ab691f983ae41100  tests/domain/helpers/api-fixtures.ts
26ef1a50dc57b7af564061c309cc07a4c9fb1078  tests/domain/helpers/open-store.ts
4db29148ce63e031f14f989de2933a51b6382ce7  tests/domain/helpers/reserve-worker.ts
04c316f80c51508e67b2d629ac5836d2b007d453  tests/domain/helpers/temp-store.ts
a4867d439fd876fdb423670fba0e4bf83eaeb21f  tests/domain/reserve.test.ts
c843803005bc93dc07d706b6169f1e4c34bfa927  tests/domain/store-backup.test.ts
c8d77d0abfbcb751bcb04968250d63c62ac97124  tests/domain/store-concurrency.test.ts
1e156eb6775f741c29fd21b09ec7b301b3e2abd4  tests/domain/store-import.test.ts
864bc354dddf4ec867a073d2f69e89119b737e57  tests/domain/store-rows.test.ts
3f8369f35c8eb53e6ad0dac94f5190d227c944ba  tests/domain/store-write.test.ts
```

## Règles métier et tests

- [x] src/store/legacy-json.ts:73 — `checkDocument` ne vérifie ni les champs obligatoires (NOT NULL : `name`, `sortOrder`, `fromTemplate`, `pinned`, `displayName`…) ni leur type (une vue sans `typeIds` lève un `TypeError` l. 129) : `db:check` dit « aucun problème » sur un fichier que l'import refuse ensuite par une `SqliteError` brute qui ne nomme ni collection ni identifiant (FR-005, T014, T017). Correction : ajouter un contrôle « champ obligatoire absent ou de mauvais type » par collection (`items: <id> → name absent`), avec son test dans `tests/domain/store-import.test.ts`.
- [x] src/store/connection.ts:99 — le journal « ancien fichier importé » s'écrit avant le `COMMIT` (l. 108) : si le `COMMIT` échoue, il annonce un import annulé (FR-002, T015). Correction : l'écrire après `COMMIT`.
- [x] src/store/diff.ts:19 — deux lignes de même clé dans le document rendu par `mutate` sont fusionnées en silence par la `Map` : une ligne disparaît sans être signalée (FR-007, T009). Correction : lever une erreur quand `after` contient deux fois la même clé, avec un test dans `tests/domain/store-write.test.ts`.
- [x] src/store/schema.ts:40 — `role` (et `kind` l. 79) n'ont qu'un `$type` TypeScript, sans contrainte en base qui limite les valeurs à `owner`/`member` (`all`/`types`/`person`), alors que data-model.md et T006 les citent comme contraintes. Correction : ajouter un `check()` Drizzle et régénérer la migration, ou retirer ces valeurs des contraintes de data-model.md. Corrigé par `check()` ; migration `0000_init` régénérée (rien n'était déployé).
- [x] tests/domain/store-import.test.ts:202 — seule l'`ApiSession` expirée est testée ; rien ne vérifie qu'une `PasswordReset` expirée importée reste refusée (cas limite « Sessions et réinitialisations expirées », T012). Correction : ajouter une demande expirée au JSON et vérifier que `resetPasswordWithToken` la refuse après l'import.
- [x] tests/domain/store-import.test.ts:72 — le cas « champs anciens » garde `sortOrder: 0` au lieu de retirer le champ, ce qui ne teste pas la branche `typeof type.sortOrder !== "number"` de `normalizeDocument` (FR-003, T012). Correction : retirer `sortOrder` des libellés et vérifier l'ordre alphabétique recalculé.
- [x] tests/domain/store-rows.test.ts:55 — l'aller-retour ne couvre pas la base de démo construite par `importTemplate`, que T004 demande. Correction : ajouter un aller-retour sur `importTemplate(emptyDatabase(), "demo-list", seed)` de `data/demo-seed.json`.
- [x] tests/domain/store-backup.test.ts:23 — la boucle d'écritures (200 au plus, même processus) peut finir avant que le processus fils lance la sauvegarde : le test peut passer sans sauvegarde pendant des écritures (US3 scénario 1, T026). Correction : écrire tant que `writing` est vrai, et vérifier qu'au moins une écriture a lieu pendant `run`.
- [x] tests/domain/store-write.test.ts:87 — aucun test ne vérifie que l'index unique `reservations.item_id` refuse une deuxième réservation de la même idée écrite sans passer par le domaine (principe III renforcé, FR-008). Correction : ajouter ce cas (`/UNIQUE/` attendu, `readDocument()` inchangé).

## Constitution et sécurité

- [x] src/store/legacy-json.ts:156 — le message de `JSON.parse` est recopié dans `LegacyImportError`, puis écrit dans les journaux par `startup.ts:10` ; V8 y met un extrait du fichier (`…"{"email":"…` ), donc un JSON abîmé peut faire fuiter un e-mail, un nom ou une empreinte de mot de passe dans les journaux (principe I, contrat « jamais d'e-mail, de nom ni de jeton »). Correction : ne garder que la position (ligne, colonne) ou un texte fixe, et tester qu'aucun contenu du fichier n'apparaît dans `problems`.

## Duplication

- [x] scripts/db-sessions.mjs:13 (remplacé par `scripts/db-sessions.ts`) — recopie la règle « `WISHLIST_DATA_PATH` → `.db` » et ouvre sa propre connexion alors qu'il n'est pas dans l'image et que `mobile/scripts/e2e.mjs` lance déjà des scripts avec `tsx`. Correction : le lancer avec `--import tsx` et réutiliser `databaseFilePath` / `readDocument` de `src/store/`.
- [x] scripts/db-check.ts:23 — l'ouverture en lecture seule d'un `.db` puis `readAll(drizzle(…))` est réécrite dans `tests/domain/store-backup.test.ts:38`. Correction : exporter une fonction `readDatabaseFile(file)` depuis `src/store/` et l'appeler aux deux endroits.
- [x] tests/domain/helpers/temp-store.ts:7 — `withTempDataPath` refait la gestion du dossier temporaire de `withStore` (`tests/domain/helpers/api-fixtures.ts:95`). Correction : écrire `withStore` sur `withTempDataPath`.
- [x] tests/domain/store-write.test.ts:30 — chaque test enchaîne `withTempDataPath` puis `replaceDocument(apiDoc())`, ce que fait `withStore(apiDoc(), …)`. Correction : utiliser `withStore`.
- [x] tests/domain/accounts.test.ts:42 — bloc modifié (ajout de `closeStore`) qui garde une gestion du dossier temporaire écrite à la main, comme `tests/domain/reserve.test.ts:91`. Correction : passer ces deux blocs à `withTempDataPath`.

## Conventions

- [x] scripts/db-sessions.mjs:19 — requête SQL directe hors de `src/store/` (AGENTS.md, Couches : « jamais par une requête directe hors de `src/store/` »). Correction : passer par `src/store/` (même correction que le point de duplication sur ce fichier).
- [x] scripts/db-check.ts:23 — ouvre une connexion à côté de `src/store/connection.ts` (même règle). Correction : fonction d'ouverture en lecture seule dans `src/store/` (même correction que le point de duplication sur ce fichier).
- [x] scripts/db-backup.mjs:16 — règle de chemin recopiée et base ouverte hors de `src/store/` ; justifié (le script tourne sans `tsx` dans l'image) mais l'exception n'est pas écrite (même règle). Correction : écrire l'exception dans la section Conventions d'`AGENTS.md`. Corrigé en documentant l'exception ; le script reste en JS simple.
- [x] src/store/diff.ts:7 — double cast `as unknown as Row[]` pour faire taire le compilateur (typage strict). Correction : typer `Collection` avec un générique sur `K extends keyof Database`.
- [x] src/store/rows.ts:64 — trois casts enchaînés pour construire le document (l. 64, 66, 68) (typage strict). Correction : même `Collection` générique, ou une lecture typée par table.
- [x] src/store/legacy-json.ts:101 — cast de `key` pour faire accepter le type `(row: never) => …` de la l. 91 (typage strict). Correction : un appel typé de `duplicates` par contrôle, ou une fonction générique sur `K extends keyof Database`.
- [x] deploy/backup-whishlist.sh:12 — la variable `WHISHLIST_CONTAINER` n'est documentée que dans `deploy/DEPLOY-RUNTIPI.md` (AGENTS.md, Variables d'environnement), comme `WHISHLIST_BACKUP_DIR` et `WHISHLIST_BACKUP_KEEP` avant elle. Correction : ajouter les variables des scripts d'exploitation au README, ou écrire dans `AGENTS.md` qu'elles en sont dispensées, comme les `E2E_*`.
- [x] package.json:15 — `npm run bench:store` appelle `scripts/bench-store.ts`, qui n'existe pas encore (prévu à l'étape 2, T040). Correction : retirer la ligne jusqu'à l'étape 2, ou l'ajouter avec T040. Corrigé en retirant la ligne ; T040 la remet.

## i18n

Aucun point.
