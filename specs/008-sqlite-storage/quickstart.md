# Quickstart : vérifier la migration vers la base embarquée

Parcours à la main, sur la base de démo, qui confirme chaque user story (principe IV). Les tests automatiques sont décrits dans [research.md](./research.md#r12-tests) ; le contrat du store dans [contracts/store.md](./contracts/store.md).

## Prérequis

- `npm ci` à la racine (installe `better-sqlite3`, `drizzle-orm`, `drizzle-kit`).
- `DEMO_PASSWORD` exporté (au moins 10 caractères).
- Pour l'app : `npm --prefix mobile ci` et un simulateur, comme dans `mobile/.maestro/README.md`.
- La version **précédente** de l'app disponible (la branche `main` avant cette feature, ou l'image Docker en prod), pour l'US1.

## US1 — Mise à jour depuis l'ancien fichier, sans perte

1. Sur la version précédente : `npm run demo:data -- tmp/migr/wishlist.json`, puis `WISHLIST_DATA_PATH=tmp/migr/wishlist.json npm run dev -- --port 3010`.
2. Sur le site, se connecter avec `alex@example.test`, réserver une idée de la liste de démo depuis une fenêtre privée, ouvrir une demande de réinitialisation de mot de passe et garder le lien (`data/password-reset.log` sans service d'e-mail). Dans l'app (pointée sur le port 3010), se connecter avec un autre compte de démo.
3. Arrêter le serveur. Noter le nombre d'enregistrements par collection : `node -e 'const d=require("./tmp/migr/wishlist.json");for(const k in d)console.log(k,d[k].length)'`.
4. Passer sur cette feature, `npm ci`, puis `npm run db:check -- tmp/migr/wishlist.json` : **attendu** « aucun problème ».
5. `WISHLIST_DATA_PATH=tmp/migr/wishlist.json npm run dev -- --port 3010`. **Attendu** : le journal du serveur dit que l'ancien fichier a été importé ; `tmp/migr/wishlist.db` existe.
6. **Attendu**, sans se reconnecter : la session du site est toujours ouverte ; l'app affiche toujours ses listes ; l'idée réservée l'est toujours ; le lien de lecture et le lien d'invitation de la liste de démo marchent ; le lien de réinitialisation gardé à l'étape 2 marche.
7. Comparer les nombres de l'étape 3 avec `npm run db:check -- tmp/migr/wishlist.db --counts` : **attendu** identiques.
8. Redémarrer le serveur : **attendu** pas de nouvel import dans le journal ; `tmp/migr/wishlist.json` n'a pas changé (`shasum` avant/après).

### Cas limites

- Copier `tmp/migr/wishlist.json` en `tmp/bad/wishlist.json`, y casser le JSON (supprimer une accolade). `WISHLIST_DATA_PATH=tmp/bad/wishlist.json npm run dev` : **attendu** le serveur refuse de démarrer, avec un message qui le dit ; aucun `tmp/bad/wishlist.db` créé.
- Même chose avec un JSON valide où une idée pointe vers une liste absente : **attendu** refus qui nomme `items` et l'identifiant de l'idée, sans e-mail ni nom.
- `WISHLIST_DATA_PATH=tmp/neuf/wishlist.json npm run dev` sur un dossier vide : **attendu** démarrage sur une base vide, inscription possible.

## US2 — Aucun comportement ne change

1. `npm run lint && npm run typecheck && npm test` : **attendu** tout passe.
2. `npm --prefix mobile run lint && npm --prefix mobile run typecheck && npm --prefix mobile test` : **attendu** tout passe.
3. Suite e2e de l'app mobile (serveur sur `WISHLIST_DATA_PATH=tmp/e2e/wishlist.json`, port 3010) : `DEMO_PASSWORD=… npm --prefix mobile run e2e` : **attendu** même résumé qu'avant la feature.
4. Rejouer les parcours manuels des `quickstart.md` des features 005 et 006 sur la base de démo (export des données, suppression d'un compte membre d'une liste partagée) : **attendu** même résultat qu'avant.
5. Double réservation : ouvrir la même idée libre dans deux fenêtres privées, remplir les deux formulaires, envoyer les deux au plus près : **attendu** une seule réussit, l'autre affiche le message « déjà réservée » habituel.

## US3 — Sauvegarde et restauration

1. Serveur en marche (local ou conteneur). Pendant qu'une fenêtre réserve et annule des idées : `node scripts/db-backup.mjs tmp/backups/wishlist-test.db` (en conteneur : `docker exec whishlist node scripts/db-backup.mjs /data/.backup-<date>.db`). **Attendu** : la commande réussit sans arrêter le serveur.
2. Arrêter le serveur ; copier la sauvegarde dans un dossier neuf sous le nom `wishlist.db` (sans `-wal` ni `-shm`) ; démarrer avec `WISHLIST_DATA_PATH=<dossier neuf>/wishlist.json`. **Attendu** : les données sont celles du moment de la sauvegarde, tout marche.
3. Relire `README.md` et `deploy/DEPLOY-RUNTIPI.md` : **attendu** mise à jour, sauvegarde, restauration et retour à la version précédente y sont, avec la mise en garde sur les changements perdus. Chronométrer la sauvegarde + restauration en suivant seulement la doc : **attendu** moins de 10 minutes (SC-006).

## US4 — Rapide quand la base grandit (étape 2)

1. `npm run bench:store` sur l'étape 1 (commit de fin d'étape 1), puis sur l'étape 2. **Attendu** : sur l'étape 2, la médiane « ouvrir une liste », « réserver » et « synchroniser l'app » sur la base agrandie (≥ 100 × la démo) est au plus le double de celle de la base de démo (SC-005).
2. `npm run lint` : **attendu** aucune erreur `no-restricted-imports` (aucun accès à tout le document dans `app/` ni `src/server/`).
3. `npm test` : **attendu** tout passe, y compris le test d'équivalence des portées.
4. Rejouer les étapes 3 à 5 de l'US2.

## US5 — Démo et développement

1. Depuis un clone neuf : `npm ci`, `npm run demo:data -- tmp/demo-wishlist.json`, `WISHLIST_DATA_PATH=tmp/demo-wishlist.json npm run dev`. **Attendu** : `tmp/demo-wishlist.db` créé, connexion avec `alex@example.test`.
2. `DEMO_BASE_URL=http://localhost:3010 npm run demo:capture` sur un serveur de démo : **attendu** captures produites comme avant.
3. Lancer l'e2e deux fois de suite sans redémarrer le serveur : **attendu** la seconde exécution repart d'une base de démo neuve (remise à zéro pendant que le serveur tourne).
4. Après `npm test` : **attendu** `data/wishlist.json` et `data/wishlist.db` n'ont pas été créés ni modifiés par les tests (`git status`, dates de modification).

## Déploiement en prod (Mac mini)

1. Copier `data-prod/wishlist.json` hors du volume (sauvegarde de l'ancien format).
2. `npm run db:check -- <copie>` : corriger tout problème avant de continuer.
3. `docker build`, puis redémarrer le service avec `deploy/compose.prod.yml` comme d'habitude. Lire les journaux : **attendu** import fait, aucune erreur.
4. Rejouer l'étape 6 de l'US1 sur le site de prod avec son propre compte.
