# Research: suite de tests de bout en bout pour l'app mobile

Chaque décision suit le format Décision / Pourquoi / Alternatives écartées.

## R1. Outil : Maestro (2.x), déjà installé

- **Décision** : Maestro, parcours en YAML dans `mobile/.maestro/`. La version installée sur la machine de développement est la 2.8.0. Le guide indique `curl -Ls https://get.maestro.mobile.dev | bash` pour l'installer.
- **Pourquoi** : la demande le nomme, les parcours jetables de la 005 l'utilisent déjà, il pilote le simulateur iOS et l'émulateur Android sans rien ajouter à l'app (pas de dépendance npm, pas de code natif), et il lit les `testID` React Native (`id:` dans un sélecteur).
- **Alternatives écartées** : Detox (dépendance native et build dédié, configuration lourde avec Expo) ; Appium (serveur à part, parcours en code, plus lent).

## R2. Serveur : celui de la personne qui développe, lancé sur une base dédiée

- **Décision** : la suite ne démarre pas de serveur. Elle exige un `next dev` lancé avec `WISHLIST_DATA_PATH=tmp/e2e/wishlist.json` (port par défaut 3010, comme les captures du guide), et vérifie qu'il lit bien ce fichier (R3).
- **Pourquoi** : Next 16 pose un verrou qui interdit deux `next dev` dans le même projet (`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`) ; une suite qui démarre son serveur échouerait dès que `npm run dev` tourne déjà. `next start` (production) ne convient pas : voir R4.
- **Alternatives écartées** : démarrer `next dev` dans le runner (conflit de verrou) ; `next build && next start` sur une copie (limite de débit en mode refus, build de plusieurs minutes à chaque exécution).

## R3. Base connue à chaque exécution, et preuve que le serveur la lit

- **Décision** : avant le premier parcours, le runner régénère `tmp/e2e/wishlist.json` avec le script de démo existant (`scripts/create-demo-data.mjs`, écrit dans un fichier temporaire puis renommé). Ensuite il se connecte à l'API avec `alex@example.test` et vérifie qu'une nouvelle session API vient d'apparaître dans ce fichier, puis se déconnecte. Si elle n'y est pas, le serveur lit un autre fichier : le runner s'arrête et affiche la commande de lancement attendue.
- **Pourquoi** : le store relit le JSON à chaque requête (`src/store/db.ts`, `cache` de React limité à une requête), donc réécrire le fichier suffit à repartir d'une base neuve sans redémarrer le serveur. La vérification par écriture prouve que le serveur et le runner parlent du même fichier ; une simple lecture (liste publique de démo) répondrait aussi sur `tmp/demo-wishlist.json`, qui a le même contenu.
- **Alternatives écartées** : remise à zéro avant chaque parcours (plus lent et inutile : chaque parcours crée ce qu'il modifie, R6) ; route d'API de remise à zéro (mécanisme serveur en plus, dangereux en production).

## R4. Limite de débit

- **Décision** : rien à ajouter. Sans IP de confiance (`cf-connecting-ip`, `x-real-ip`), `missingIpPolicy()` rend `skip` hors production (`src/server/rate-limit.ts`). En local, l'app parle au serveur sans proxy, sans ces en-têtes : aucune limite ne s'applique.
- **Pourquoi** : FR-013 est tenu sans toucher au serveur ; en production (`NODE_ENV=production`), la politique reste `deny` et la limite est intacte. Le runner refuse une URL de serveur qui n'est pas locale (`localhost`, `127.0.0.1`), pour que la suite ne vise jamais la production. Comme l'adresse visée par l'app est fixée à son build, les parcours le prouvent aussi : `login.yaml` vérifie la liste de démo, qui n'existe que dans la base de la suite, et `register.yaml` fait cette vérification avant de créer un compte (revue de la feature).
- **Alternatives écartées** : variable pour désactiver la limite (affaiblit le serveur si elle fuit en production).

## R5. État de l'app au début de chaque parcours

- **Décision** : chaque parcours commence par le sous-parcours `launch-clean.yaml` : `launchApp` avec `clearState: true`, puis `clearKeychain` (iOS).
- **Pourquoi** : `clearState` efface les données de l'app (SQLite, file hors ligne). Sur iOS, le trousseau survit à l'effacement des données : sans `clearKeychain`, le jeton de session (stockage sécurisé) ferait revenir l'app connectée. Sur Android, le stockage sécurisé est dans les données de l'app et `clearState` suffit.
- **Alternatives écartées** : désinstaller et réinstaller l'app entre parcours (lent, et casse le lien avec Metro en debug).

## R6. Données créées par les parcours, noms uniques

- **Décision** : les parcours qui ne font que lire ou qui ajoutent des données réversibles utilisent les comptes de démo (Alex, Camille). Les parcours destructifs ou qui créent un compte (création de compte, suppression du compte, export) inscrivent leur propre compte `e2e-<suffixe>@example.test`. Le suffixe vient d'un petit script Maestro (`scripts/unique.js`, `output.unique` = horodatage + aléa). Les listes et idées créées portent ce suffixe aussi.
- **Pourquoi** : FR-006 et FR-007 ; un parcours relancé deux fois de suite ne bute pas sur « adresse déjà utilisée ». La base étant régénérée à chaque exécution de la suite, ces comptes ne s'accumulent pas.
- **Alternatives écartées** : comptes fixes par parcours dans le script de démo (impossible de relancer un parcours destructif seul sans remettre la base à zéro).

## R7. Sélecteurs : `testID` pour agir, textes des fichiers de traduction pour vérifier

- **Décision** :
  - Toute action (tap, saisie) vise un `testID` (`id:` dans Maestro), selon la convention de [contracts/test-ids.md](contracts/test-ids.md).
  - Les messages vérifiés (erreur de connexion, prix invalide…) viennent des fichiers `locales/<langue>/*.json`. Le runner les écrit dans `mobile/.maestro/scripts/strings.generated.js` (non versionné), qui pose `output.t` ; un parcours les charge avec `runScript` et vérifie `assertVisible: ${output.t.auth.login.invalid}`.
  - Le runner échappe les caractères spéciaux des expressions régulières, puisque Maestro compare les textes comme des regex.
  - Les textes avec variable (« {{count}} changements… ») ne sont pas vérifiés mot pour mot : un `testID` suffit (`pending-badge`, `offline-banner` existent déjà).
- **Pourquoi** : une reformulation dans `locales/` ne casse aucun parcours, la suite marche en français comme en anglais (cas limite « langue du simulateur »), et ce qui est vérifié reste le texte réellement affiché.
- **Alternatives écartées** : textes en dur dans les parcours (cassent à chaque reformulation et selon la langue) ; forcer la langue du simulateur (redémarrage du simulateur sur iOS, root sur Android).

## R8. Langue du simulateur

- **Décision** : `E2E_LANG=fr|en` si posé ; sinon le runner lit la langue de l'appareil (iOS : `xcrun simctl spawn <udid> defaults read -g AppleLanguages` ; Android : `adb shell getprop persist.sys.locale`, puis `ro.product.locale`) ; `fr` si la langue n'est pas l'anglais, comme l'app (005, US6, scénario 5).
- **Pourquoi** : les textes de R7 doivent être ceux que l'app affiche.

## R9. Hors ligne

- **Décision** : le parcours 005-US5 coupe le réseau avec `setAirplaneMode` de Maestro, qui ne marche que sur Android. Il porte le tag `android-only` ; sur iOS, le runner l'exclut (`--exclude-tags android-only`) et l'affiche « non joué : le simulateur iOS ne permet pas de couper le réseau de l'app », sans le compter comme réussi.
- **Pourquoi** : l'app décide du mode hors ligne d'après NetInfo (`mobile/src/network.ts`). Le simulateur iOS partage le réseau du Mac et n'a pas de mode avion. Arrêter le serveur ne ferait pas passer NetInfo hors ligne : l'app afficherait des erreurs réseau, ce qui n'est pas le parcours de l'US5.
- **Point à vérifier à l'implémentation** : avec `adb reverse` (R10), le serveur reste joignable par le câble adb pendant le mode avion. C'est sans effet si la file hors ligne n'envoie rien tant que NetInfo dit hors ligne ; si ce n'est pas le cas, l'app de la suite doit être compilée vers `http://10.0.2.2:<port>`, sans changer l'URL du runner, qui reste locale.
- **Alternatives écartées** : interrupteur réseau caché dans l'app pour les tests (change le comportement de l'app, contraire à FR-017) ; proxy coupable devant le serveur (même problème que l'arrêt du serveur).

## R10. Joindre le serveur depuis l'émulateur Android

- **Décision** : le runner lance `adb -s <device> reverse tcp:<port> tcp:<port>` avant les parcours, pour que `http://localhost:3010` compilé dans l'app marche aussi sur l'émulateur.
- **Pourquoi** : un seul build (`EXPO_PUBLIC_API_URL=http://localhost:3010`) pour les deux plateformes.

## R11. Build de l'app pour la suite

- **Décision** : le guide recommande un build Release local, avec l'URL du serveur compilée : `EXPO_PUBLIC_API_URL=http://localhost:3010 npx expo run:ios --configuration Release` (Android : `--variant release`). Un build Debug avec Metro marche aussi, mais il peut afficher des avertissements LogBox par-dessus l'écran. Le runner vérifie que l'app `app.ohyoushouldnt.mobile` est installée sur l'appareil (`xcrun simctl get_app_container`, `adb shell pm path`), sans la construire.
- **Pourquoi** : le build Release ne dépend pas de Metro et n'affiche ni LogBox ni menu de développement, donc les parcours échouent moins au hasard (SC-003). Construire l'app dans le runner prendrait plusieurs minutes à chaque exécution.
- **Alternatives écartées** : build EAS (cloud, lent, inutile en local) ; variante `development` (identifiant `.dev`, catalogue de composants).

## R12. Résultats et résumé

- **Décision** : `maestro test --device <id> --format junit --output <dir>/report.xml --test-output-dir <dir>`. `<dir>` vaut `tmp/e2e/results/<horodatage>-<plateforme>/` (`tmp/` est ignoré par git). Maestro y range, par parcours, ses journaux et une capture de l'écran au moment de l'échec. Le runner lit le rapport JUnit et affiche une ligne par parcours (réussi, échoué avec l'étape, non joué avec la raison), puis le chemin du dossier. Il rend le code de sortie de Maestro, et 2 si un prérequis manque.
- **Pourquoi** : FR-010, FR-011, US4, sans outil de rapport en plus.

## R13. Lancement et sélection des parcours

- **Décision** : `npm --prefix mobile run e2e -- [--platform ios|android] [fichiers de parcours…]`. Sans fichier, tous les parcours de `flows/` sont joués. La plateforme est déduite s'il n'y a qu'un appareil démarré ; s'il y en a deux, `--platform` est demandé. Le runner est un script Node sans dépendance (`mobile/scripts/e2e.mjs`), comme `licenses.mjs`, et ses fonctions pures sont dans `mobile/scripts/e2e/` pour être testées.
- **Pourquoi** : FR-001 et US2, avec une seule commande pour toute la suite comme pour un parcours.

## R14. Garde-fous automatiques (jest)

- **Décision** : deux tests dans `mobile/__tests__/e2e/` :
  1. **identifiants** : chaque `id:` utilisé dans un parcours existe comme `testID` littéral (ou préfixe documenté pour les identifiants dynamiques) dans `mobile/app/` ou `mobile/src/` ;
  2. **couverture** : chaque `### User Story N` des specs 005 et 006 a un parcours tagué `005-usN` / `006-usN`, ou une entrée dans `mobile/.maestro/exclusions.md`.

  Les fonctions pures du runner (lecture du rapport JUnit, génération de `strings.generated.js` avec échappement des regex, détection de la langue) ont aussi leurs tests.
- **Pourquoi** : un `testID` renommé ou une story ajoutée sans parcours se voient dans `npm --prefix mobile test`, sans simulateur (SC-002, US5).

## R15. Variables d'environnement

- **Décision** : `DEMO_PASSWORD` (existant, obligatoire), `E2E_API_URL` (défaut `http://localhost:3010`), `E2E_LANG` (facultatif). Ce sont des variables du runner, pas de l'app ni du serveur : elles sont documentées dans le guide de la suite (`mobile/.maestro/README.md`) et dans `AGENTS.md`, pas dans le tableau du `README.md`, `.env.example` ni `deploy/compose.prod.yml`, qui décrivent la configuration du serveur.
- **Pourquoi** : la règle « nouvelle variable → README, .env.example, compose » vise la configuration de l'app déployée. Le mot de passe de démo passe à Maestro par l'environnement (`MAESTRO_DEMO_PASSWORD`) et n'est écrit dans aucun fichier versionné (FR-014). Il passe à Maestro par l'environnement (`MAESTRO_DEMO_PASSWORD`), pas par `-e` : un argument de processus serait visible avec `ps` (revue de la feature).

## R16. Ce qui reste manuel (liste d'exclusions)

- **Décision** : `mobile/.maestro/exclusions.md` liste ce que la suite ne vérifie pas, avec un renvoi au `quickstart.md` qui reste manuel :
  - 005-US4 : scanner le QR code avec un autre téléphone ; contenu reçu par la feuille de partage ; ouverture de la page publique ;
  - 005-US1 : lien de réinitialisation reçu par e-mail ; changement de mot de passe fait sur le site ;
  - 005-US3 : préremplissage depuis un lien (service externe optionnel) ;
  - 005-US5 sur iOS : le parcours entier (R9) ;
  - 005-US6 : la story entière (comparaison visuelle avec le site) ;
  - 006-US3 : contenu du fichier exporté (ce que voit l'app : la feuille de partage s'ouvre) ;
  - 006-US4 : le lien « Nous écrire », car le simulateur iOS n'a pas d'app Mail.

  Les vérifications « visible sur le site » de l'Independent Test des stories restent manuelles ; la suite vérifie dans l'app après un rafraîchissement.
- **Pourquoi** : FR-009, et le principe IV : le parcours réel des `quickstart.md` reste la preuve qu'une tranche est faite.
