# Research: Stockage des données dans une base embarquée

Toutes les inconnues du Technical Context sont tranchées ici. Les versions ont été vérifiées sur npm le 2026-10-31.

## R1. Pilote SQLite

- **Decision** : `better-sqlite3` **12.x** (12.11.1), avec `drizzle-orm` 0.45.x (`drizzle-orm/better-sqlite3`) et `drizzle-kit` 0.31.x en dépendance de dev.
- **Rationale** : pilote synchrone, le plus utilisé avec Drizzle ; il gère WAL, `busy_timeout`, `backup()` et des transactions ouvertes à la main (`BEGIN IMMEDIATE`), ce dont l'étape 1 a besoin (R4). Next le met déjà dans sa liste `serverExternalPackages` : il n'est pas empaqueté et le build `standalone` copie son binaire. La 12.x accepte Node 20 à 26 ; la 13.x exige Node 22, ce qui contredirait la constitution (« Node.js 20 ou plus en dev »).
- **Alternatives considered** :
  - `node:sqlite` (intégré à Node) : pas de module natif à installer, mais pas disponible sans option sur Node 20, API encore marquée instable, et le support Drizzle n'est pas dans la version stable.
  - `@libsql/client` : asynchrone, pensé pour un serveur libSQL distant ; la porte de sortie voulue est Postgres, pas libSQL.
  - `better-sqlite3` 13.x : refusé pour la contrainte Node 20 ; à reprendre quand la constitution passera à Node 22.

## R2. Emplacement du fichier de base et variables d'environnement

- **Decision** : aucune nouvelle variable. La base vit à côté de l'ancien fichier, même nom avec l'extension `.db` : `WISHLIST_DATA_PATH=/data/wishlist.json` → base `/data/wishlist.db` (fichiers annexes `wishlist.db-wal`, `wishlist.db-shm`). Une valeur qui finit déjà par `.db` est prise telle quelle (pas d'ancien fichier à importer).
- **Rationale** : FR-017 demande qu'une installation existante marche sans changer sa configuration. Les commandes de démo et d'e2e (`WISHLIST_DATA_PATH=tmp/demo-wishlist.json`, `tmp/e2e/wishlist.json`) restent valables telles quelles. Le README précise le nouveau sens de la variable.
- **Alternatives considered** : `WISHLIST_DB_PATH` séparée — plus explicite, mais deux variables à garder cohérentes, une ligne de plus dans trois fichiers, et un piège (base à un endroit, ancien fichier à un autre) sans gain réel.

## R3. Schéma et migrations

- **Decision** : schéma Drizzle dans `src/store/schema.ts`, une table par collection de `Database` (détail dans [data-model.md](./data-model.md)). Migrations SQL générées par `drizzle-kit generate` dans `drizzle/` (versionnées), appliquées à l'ouverture par le migrateur de Drizzle. Le `Dockerfile` copie `drizzle/` dans l'image.
- **Rationale** : les migrations versionnées gardent la porte de sortie vers Postgres (même schéma décrit en TypeScript, dialecte à changer) et rendent chaque évolution relisible en revue.
- **Alternatives considered** : `drizzle-kit push` au démarrage — pas de trace des changements, risque de perte sur un renommage ; SQL écrit à la main — double travail avec le schéma TypeScript.

## R4. Concurrence et atomicité (étape 1)

- **Decision** :
  - Deux connexions par processus : une **écrivain**, une **lecteur**. Réglages : `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000`.
  - `updateDocument(mutate)` : file d'attente en mémoire (une promesse chaînée), puis `BEGIN IMMEDIATE` sur l'écrivain, lecture de tout le document, `await mutate(doc)`, écriture du **différentiel** (R5), `COMMIT` ; `ROLLBACK` si `mutate` lève ou si une contrainte échoue.
  - `readDocument()` : lecture de toutes les tables dans une transaction de lecture sur la connexion lecteur, en un seul tour synchrone (instantané cohérent, jamais l'état non validé d'une écriture en cours).
- **Rationale** : certains `mutate` sont asynchrones (hachage scrypt dans `register`, `changeOwnPassword`, `resetPasswordAction`). Le `db.transaction()` de better-sqlite3 refuse les fonctions asynchrones ; une transaction ouverte à la main tient pendant l'`await`. La file en mémoire empêche deux `updateDocument` du même processus de partager la transaction ; `BEGIN IMMEDIATE` + `busy_timeout` couvre les autres processus (workers de `next dev`, script de démo, remise à zéro de l'e2e). C'est la même sérialisation qu'aujourd'hui avec `proper-lockfile`, donc aucun comportement ne change (US2), et WAL laisse les lectures passer pendant une écriture (FR-009).
- **Alternatives considered** : une seule connexion — une lecture pendant l'`await` verrait l'écriture non validée ; `BEGIN DEFERRED` — deux processus peuvent lire puis échouer à l'écriture (`SQLITE_BUSY` sans attente) ; garder `proper-lockfile` en plus — inutile, SQLite verrouille lui-même.

## R5. Écriture différentielle (étape 1)

- **Decision** : au chargement, une copie profonde (`structuredClone`) du document sert de référence. Après `mutate`, pour chaque table, comparaison par clé primaire : ligne absente avant → `INSERT` ; absente après → `DELETE` ; présente des deux côtés avec une sérialisation différente → `UPDATE` (jamais `INSERT OR REPLACE`, qui change le `rowid`). Les clés étrangères sont vérifiées au `COMMIT` (`PRAGMA defer_foreign_keys = ON` dans chaque transaction), donc l'ordre des écritures entre tables est libre.
- **Rationale** : une réservation écrit une ligne, pas toute la base ; le WAL reste petit. Les `mutate` actuels renvoient soit le même objet modifié, soit un nouvel objet : la copie de référence couvre les deux cas.
- **Alternatives considered** : tout effacer puis tout réinsérer à chaque écriture — simple mais coût proportionnel à la base, WAL énorme, `rowid` renumérotés (R6).

## R6. Ordre des enregistrements

- **Decision** : chaque `SELECT` de `readDocument` trie par `rowid`. L'import insère dans l'ordre des tableaux du JSON ; un nouvel enregistrement prend le `rowid` suivant, comme un `push` dans le tableau.
- **Rationale** : certaines pages affichent dans l'ordre du tableau (ex. listes d'un compte dans l'ordre des adhésions). Une recherche dans `src/domain` et `src/server` ne trouve aucun tri en place, `unshift` ni `splice` sur un tableau du document : l'ordre du tableau est toujours l'ordre d'insertion, que le `rowid` reproduit.
- **Alternatives considered** : une colonne `position` par table — à maintenir à chaque écriture pour un besoin que le `rowid` couvre déjà.

## R7. Import de l'ancien fichier

- **Decision** :
  - Une table `meta` (clé, valeur) porte la clé `legacy_import` : `"imported:<date ISO>"` ou `"none"` (installation neuve).
  - À l'ouverture, après les migrations, si la clé manque : `BEGIN IMMEDIATE`, nouvelle vérification de la clé (un seul processus importe), puis, si l'ancien fichier existe : lecture, `normalizeDocument` (déplacé dans `src/store/legacy-json.ts`), contrôle d'intégrité, insertion de tout, écriture de la clé, `COMMIT`. Sinon, clé `"none"`.
  - Une erreur annule toute la transaction : au démarrage suivant, l'import recommence depuis le fichier (tout ou rien, sans doublon).
  - L'ancien fichier n'est jamais modifié ni renommé.
- **Contrôle d'intégrité** (décision laissée au plan par la spec) : l'import **s'arrête en nommant les enregistrements fautifs** par collection et identifiant (jamais l'e-mail ni le nom, pour ne pas mettre de données personnelles dans les journaux). Contrôles : collections présentes et en tableaux, identifiants en double, e-mails en double, jetons en double, plus d'une réservation par idée, références vers une liste, une idée, un libellé, une personne ou un compte absents. Une commande `npm run db:check -- <fichier.json>` fait le même contrôle à blanc, sans rien écrire, pour vérifier une copie de la prod **avant** de déployer.
- **Rationale** : la spec interdit qu'une ligne disparaisse sans être signalée. Garder des lignes orphelines obligerait à désactiver les clés étrangères, et l'étape 2 perdrait sa garantie. Le domaine maintient déjà ces liens (suppression de liste, d'idée, de compte), donc la prod ne devrait rien contenir de fautif ; `db:check` le confirme avant la mise à jour.
- **Alternatives considered** : garder les orphelins sans clés étrangères — l'incohérence resterait cachée ; réparer automatiquement (supprimer les orphelins) — perte silencieuse interdite par la spec.

## R8. Ouverture au démarrage du serveur

- **Decision** : `instrumentation.ts` à la racine ; `register()` ouvre le store quand `process.env.NEXT_RUNTIME === "nodejs"` (import dynamique de `src/store/connection.ts`) : connexion, migrations, import. En cas d'échec, message dans les journaux puis `process.exit(1)`. Les scripts et les tests ouvrent le store eux-mêmes, à la première utilisation (même fonction).
- **Rationale** : la doc Next 16 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`) dit que `register` est appelé une fois et doit finir avant que le serveur serve une requête : c'est exactement FR-002 (import avant la première requête) et FR-005 (refus de démarrer). Le conteneur qui s'arrête rend l'échec visible ; il ne sert pas de pages vides.
- **Alternatives considered** : ouverture paresseuse à la première requête seule — le serveur démarrerait puis répondrait 500 à tout, ce qui ressemble à une panne plutôt qu'à un refus explicite.

## R9. Droits sur les fichiers

- **Decision** : avant la première ouverture, créer le fichier de base avec le mode `0600` ; après l'ouverture en WAL, `chmod 0600` sur `.db`, `.db-wal` et `.db-shm` (échec ignoré, comme aujourd'hui sur un FS sans `chmod`). `.gitignore` ignore `data/*.db`, `data/*.db-wal`, `data/*.db-shm`.
- **Rationale** : même protection que l'ancien fichier (FR-010), principe I de la constitution.

## R10. Sauvegarde et restauration

- **Decision** : `scripts/db-backup.mjs <destination>` utilise l'API `backup()` de better-sqlite3 sur la base en marche (copie cohérente, en ligne). Le script est copié dans l'image ; la doc donne `docker exec whishlist node scripts/db-backup.mjs /data/.backup-<date>.db`. La restauration : arrêter le conteneur, remplacer `wishlist.db` par la sauvegarde, supprimer `wishlist.db-wal` et `wishlist.db-shm`, redémarrer. Le retour arrière vers la version précédente : image précédente + ancien `wishlist.json` (resté intact), en sachant que les changements faits depuis sont perdus.
- **Rationale** : copier `wishlist.db` pendant une écriture peut donner une base incohérente (WAL non fusionné). Le `sqlite3` de l'hôte macOS sur un volume Docker Desktop est déconseillé : le verrouillage de fichiers à travers le partage n'est pas garanti. L'image n'a pas le binaire `sqlite3` ; `better-sqlite3` y est déjà.
- **Scripts d'exploitation existants** : `deploy/backup-whishlist.sh` (cron quotidien, chiffrement `openssl`, rétention) copie aujourd'hui `wishlist.json`. Il passe à : `docker exec whishlist node scripts/db-backup.mjs /data/.backup-$STAMP.db`, chiffrement ou copie de ce fichier depuis le volume vers `$BACKUP_ROOT/wishlist-$STAMP.db[.enc]`, suppression du fichier temporaire ; la rétention couvre les deux extensions (`.json*` anciens et `.db*` nouveaux). `deploy/harden-data.sh` et `deploy/ops-check.sh` traitent `wishlist.db`, `-wal`, `-shm` comme `wishlist.json` (mode `600`) ; `ops-check.sh` exige `wishlist.db` au lieu de `wishlist.json`.
- **Alternatives considered** : `VACUUM INTO` — marche aussi, mais tient un verrou de lecture plus long ; `litestream` — service annexe, contraire à la section hébergement.

## R11. Démo, captures et e2e

- **Decision** :
  - `npm run demo:data -- <chemin>` garde son argument (le même chemin que `WISHLIST_DATA_PATH`) et écrit la base `.db` correspondante via `replaceDocument` (R12), qui remplace tout le contenu dans une transaction. Il n'écrit plus de JSON.
  - La remise à zéro de l'e2e (`mobile/scripts/e2e.mjs`) appelle ce script sur `tmp/e2e/wishlist.json` pendant que le serveur tourne : le remplacement se fait dans une transaction, le serveur voit la nouvelle base à la requête suivante (aucune donnée gardée en mémoire entre deux requêtes). `checkServer` vérifie la session de démo par un petit script racine qui interroge la base (`scripts/db-sessions.ts`), au lieu de lire le JSON.
  - `demo:capture` ne lit que le serveur : rien à changer.
- **Rationale** : les commandes d'`AGENTS.md` restent les mêmes ; le remplacement transactionnel garde la garantie actuelle (« le serveur ne lit jamais un fichier à moitié écrit »).
- **Alternatives considered** : produire un JSON puis laisser l'import le reprendre — l'import ne se fait qu'une fois par base, il faudrait supprimer la base sous le serveur en marche.

## R12. Tests

- **Decision** : les tests gardent `WISHLIST_DATA_PATH` dans un `mkdtemp`. Le store garde ses connexions par chemin et expose `closeStore()` pour les tests. Les tests qui écrivent ou relisent le JSON à la main (`api-session`, `commands-items`, `commands-public-list`) passent par `replaceDocument(doc)` et `readDocument()` ; leurs attentes ne changent pas. Nouveaux tests dans `tests/domain/store-*.test.ts` : import (fidélité, normalisation des champs anciens, refus d'un fichier illisible ou incohérent, tout ou rien, pas de réimport), écriture différentielle, rollback, ordre, concurrence (100 réservations simultanées de la même idée, dont deux processus), droits des fichiers.
- **Rationale** : le guide impose un fichier temporaire par test ; `--test-concurrency=1` évite déjà les conflits entre fichiers.

## R13. Étape 2 : requêtes ciblées

- **Decision** : des **portées** (`scopes`) chargées par requêtes ciblées, sur lesquelles tournent les mêmes fonctions pures du domaine.
  - `readScope(scope)` et `updateScope(scope, mutate)` (contrat : [contracts/store.md](./contracts/store.md)) rendent un `Database` **partiel** : seulement les lignes de la portée (une liste et tout ce qui lui appartient, un compte et ses adhésions, une session, un lien de réinitialisation…).
  - `updateScope` reprend la mécanique de l'étape 1 (file, `BEGIN IMMEDIATE`, différentiel, `COMMIT`), mais le différentiel ne porte que sur les lignes chargées : rien hors de la portée ne peut être effacé par erreur.
  - Les commandes, `src/auth/current.ts`, `src/server/api/auth.ts` et les pages passent de `getDocument`/`updateDocument` à la portée dont elles ont besoin, une commande à la fois.
  - Les index uniques (e-mail, jetons, une réservation par idée) restent le filet de sécurité : une violation est traduite dans l'erreur que le domaine rend déjà (`emailTaken`, idée déjà réservée).
- **Rationale** : la constitution du projet et `AGENTS.md` posent « règles métier en fonctions pures sur `Database`, testées ». Réécrire ces règles en SQL dupliquerait la logique et perdrait les tests de domaine (FR-013). Avec des portées, une commande ne lit que sa liste ou son compte (FR-011, US4), et le domaine ne change pas.
- **Risque et parade** : une fonction du domaine qui supposerait voir toute la base (ex. « aucun compte avec cet e-mail » sur une portée qui ne contient pas les comptes) donnerait un faux résultat. Parade : chaque portée liste les fonctions du domaine qu'elle sert et ce qu'elles lisent ; un **test d'équivalence** joue chaque commande sur la base complète (étape 1) puis sur la portée (étape 2) et compare résultat et base finale.
- **Alternatives considered** : des requêtes Drizzle écrites commande par commande sans le domaine — plus rapide à l'exécution, mais règles dupliquées et tests à réécrire ; garder `getDocument` pour les pages — contraire à FR-012.

## R14. Mesure de performance (SC-005)

- **Decision** : `scripts/bench-store.ts` génère une base fictive (comptes `@example.test`) d'au moins 100 fois la base de démo, puis mesure via les commandes : ouvrir une liste (`/api/v1/lists/{id}` et sa page), réserver une idée, et la lecture que fait l'app à la synchronisation. Il affiche la médiane sur 50 essais, base de démo et base agrandie, avant (étape 1) et après (étape 2).
- **Rationale** : SC-005 se vérifie par un chiffre reproductible, sans donnée réelle (principe I).

## R15. Ce qui reste un accès à tout le document après l'étape 2 (FR-014)

- **Decision** : `readDocument`, `updateDocument` et `replaceDocument` restent dans `src/store/db.ts` pour : l'import (`legacy-json.ts`), `demo:data`, `scripts/backfill-og.ts`, `db:check`, `bench-store` et les tests. Aucune commande, page, action ni route d'API ne les appelle ; une règle ESLint `no-restricted-imports` l'interdit dans `app/` et `src/server/`.
- **Rationale** : rend FR-014 vérifiable par le lint plutôt que par une relecture.
