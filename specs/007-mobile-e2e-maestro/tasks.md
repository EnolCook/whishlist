---

description: "Tâches de la feature Suite de tests de bout en bout pour l'app mobile"
---

# Tasks: Suite de tests de bout en bout pour l'app mobile

**Input**: Design documents from `specs/007-mobile-e2e-maestro/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/e2e-command.md](contracts/e2e-command.md), [contracts/test-ids.md](contracts/test-ids.md), [quickstart.md](quickstart.md)

**Tests** : inclus. Le plan prévoit deux garde-fous jest (identifiants, couverture) et des tests des fonctions pures du runner (R14). Les parcours Maestro sont eux-mêmes les tests de l'app.

**Organization** : une phase par User Story, dans l'ordre de priorité de la spec :

- US1 (suite d'une commande) et US2 (parcours seul), toutes deux P1 ;
- US3 (couverture 005 et 006) et US4 (comprendre un échec), toutes deux P2 ;
- US5 (doc) en P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (autre fichier, pas de dépendance sur une tâche non finie)
- **[Story]** : User Story de la spec (US1 à US5)

## Règles communes à toutes les tâches

- **Maestro** : version 2.x. Avant d'écrire une commande dont la syntaxe est incertaine (`clearKeychain`, `setAirplaneMode`, `runScript` et `output`, `runFlow` avec `env`, `--test-output-dir`), vérifier dans la doc (<https://docs.maestro.dev>) ou avec `maestro --help`.
- **Parcours** ([data-model.md](data-model.md)) :
  - en-tête `appId: app.ohyoushouldnt.mobile`, `name: "<feature> US<N> — <titre de la story>"`, et « exactement un tag de story (`005-us1`…`006-us4`) ; `android-only` si le parcours ne peut pas tourner sur iOS » ;
  - première étape `runFlow: ../subflows/launch-clean.yaml` ; connexion par `runFlow: ../subflows/login.yaml` uniquement ;
  - actions sur `id:` seulement ([contracts/test-ids.md](contracts/test-ids.md)) ;
  - textes vérifiés via `runScript: ../scripts/strings.generated.js` puis `${output.t.<ns>.<clé>}`, sans aucun texte d'interface en dur ;
  - « jamais d'attente à durée fixe » : `extendedWaitUntil` ou attente implicite.
- **testID** : forme `<écran>.<élément>` en kebab-case ; chaque écran a `<écran>.screen` sur son conteneur. Ajouter un `testID` ne change ni le style ni le comportement (FR-017). Un `testID` ne contient ni texte traduit ni donnée personnelle.
- **Données** : comptes `@example.test` seulement. `DEMO_PASSWORD` est lu dans l'environnement et n'est écrit dans aucun fichier versionné, ni dans la sortie du runner (FR-014).
- **App mobile** : Expo SDK 58 ; lire `mobile/AGENTS.md` avant de toucher à `mobile/`.
- **Commandes** : `npm --prefix mobile run lint && npm --prefix mobile run typecheck && npm --prefix mobile test`.

---

## Phase 1: Setup

**Purpose** : arborescence et scripts.

- [X] T001 Créer l'arborescence `mobile/.maestro/` : `config.yaml` (avec `flows: ["flows/*.yaml"]`), et les dossiers `flows/`, `subflows/` et `scripts/` (avec un `.gitkeep` si un dossier est encore vide).
- [X] T002 [P] Ajouter `mobile/.maestro/scripts/strings.generated.js` à `.gitignore` (racine), sous la section `tmp/`.
- [X] T003 [P] Ajouter le script `"e2e": "node scripts/e2e.mjs"` dans `mobile/package.json`. Vérifier que la config jest (`testMatch: <rootDir>/__tests__/**/*.test.ts?(x)`) prend bien `mobile/__tests__/e2e/`, et qu'eslint de `mobile/` accepte les `.mjs` de `mobile/scripts/e2e/` (sinon les ajouter comme pour `licenses.mjs`).

---

## Phase 2: Foundational (bloquant)

**Purpose** : fonctions pures du runner et sous-parcours, utilisés par toutes les stories.

**⚠️ CRITICAL** : aucune User Story ne commence avant la fin de cette phase.

### Tests (écrits avant, ils doivent échouer)

- [X] T004 [P] Écrire `mobile/__tests__/e2e/runner.test.ts` (jest), qui importe les modules de `mobile/scripts/e2e/` :
  - **`buildStrings(lang)`** :
    - rend un objet par namespace de `src/i18n/config.ts`, lu dans `locales/<lang>/` ;
    - chaque valeur est une regex qui reconnaît le texte exact : `.`, `?`, `(`, `)`, `[`, `]`, `*`, `+`, `^`, `$`, `|`, `\`, `{`, `}` sont échappés (exemple : « E-mail ou mot de passe incorrect. » → `E-mail ou mot de passe incorrect\.`) ;
    - « les clés à variable (`{{…}}`) sont omises » ;
    - `renderStringsScript(strings)` produit un JS valide qui pose `output.t`.
  - **`resolveLang({ flag, env, deviceLocale })`** : priorité `--lang` > `E2E_LANG` > langue de l'appareil. `en`, `en-US`, `en_GB` et `["en-US", …]` donnent `en`. Toute autre langue, ou une langue inconnue, donne `fr`. Une valeur de `--lang` ou `E2E_LANG` autre que `fr` ou `en` est une erreur.
  - **`parseJunit(xml)`** : rend `[{ name, status: "passed" | "failed", durationS, failedStep? }]`. `failedStep` vient du message de `<failure>`. Tester avec un rapport réussi, un échoué et un vide.
  - **`formatSummary({ platform, lang, startedAt, results, skipped, outputDir })`** :
    - une ligne par parcours (`✓`, `✗` avec l'étape à la ligne suivante, `–` `« non joué : <raison> »`) ;
    - la ligne finale « N réussis, N échoué(s), N non joué(s) — résultats : `<dir>` » ;
    - les « non joué » ne comptent pas comme des échecs.
  - **`exitCode(results)`** : 0 sans échec, 1 avec au moins un échec.
  - **`isLocalApiUrl(url)`** : vrai pour `localhost`, `127.0.0.1` et `10.0.2.2` (tout port, http), faux sinon, notamment pour `https://ohyoushouldnt.app`.

### Implémentation

- [X] T005 [P] Créer `mobile/scripts/e2e/strings.mjs` avec `escapeRegex`, `buildStrings(lang, { localesDir })` et `renderStringsScript(strings)` (R7). Lire la liste des namespaces dans `src/i18n/config.ts` (ou la même source que le test de parité des clés, sans la recopier en dur).
- [X] T006 [P] Créer `mobile/scripts/e2e/locale.mjs` avec `resolveLang` (R8), et `readDeviceLocale(platform, deviceId)` qui lance `xcrun simctl spawn <udid> defaults read -g AppleLanguages` (iOS) ou `adb -s <id> shell getprop persist.sys.locale`, puis `ro.product.locale` (Android). Elle rend `null` en cas d'échec.
- [X] T007 [P] Créer `mobile/scripts/e2e/junit.mjs` avec `parseJunit`, `formatSummary`, `exitCode`, sans dépendance : le XML de Maestro est simple, une lecture par regex des `<testcase>` et `<failure>` suffit.
- [X] T008 [P] Créer `mobile/scripts/e2e/checks.mjs` avec `isLocalApiUrl`, et les fonctions de prérequis qui lancent des commandes, chacune rendant `{ ok: true, … } | { ok: false, message }` avec les messages de [contracts/e2e-command.md](contracts/e2e-command.md) :
  - `findMaestro()` ;
  - `listDevices()` : simulateurs `Booted` de `xcrun simctl list devices booted -j`, appareils `device` de `adb devices` ;
  - `pickDevice(devices, platform)` ;
  - `isAppInstalled(device)` : `xcrun simctl get_app_container <udid> app.ohyoushouldnt.mobile` ou `adb -s <id> shell pm path app.ohyoushouldnt.mobile`.
- [X] T009 [P] Créer `mobile/.maestro/scripts/unique.js` qui pose `output.unique` (horodatage en base 36 + 4 caractères aléatoires, minuscules) (R6).
- [X] T010 [P] Créer `mobile/.maestro/subflows/launch-clean.yaml` : `launchApp` (`clearState: true`), `clearKeychain`, puis attente de `id: login.screen` (R5). Si `clearKeychain` n'existe pas sur Android, le placer sous une condition `platform: iOS`.
- [X] T011 [P] Créer `mobile/.maestro/subflows/login.yaml` : entrées `EMAIL` et `PASSWORD` (défaut `${DEMO_PASSWORD}`). Saisir `login.email` et `login.password`, appuyer sur `login.submit`, puis attendre `id: lists.screen`.
- [X] T012 Dans `mobile/app/(auth)/login.tsx`, poser `login.screen` (conteneur), `login.email`, `login.password`, `login.submit`, `login.error` (alerte d'erreur), `login.create-account`, `login.forgot` et `login.legal` (lien vers les pages légales s'il existe). Dans `mobile/app/(app)/index.tsx`, poser `lists.screen`, `lists.new` (les deux boutons « Nouvelle liste »), `lists.empty`, `` lists.card-${list.id} `` et `lists.account`. Si `Field`, `Screen` ou `AuthLayout` ne transmettent pas `testID`, l'ajouter dans `mobile/src/ui/` sans autre changement.

**Checkpoint** : `npm --prefix mobile test` passe, `runner.test.ts` compris.

---

## Phase 3: User Story 1 - Lancer toute la suite d'une commande (Priority: P1) 🎯 MVP

**Goal** : `npm --prefix mobile run e2e` vérifie les prérequis, régénère la base, joue les parcours et affiche un résumé par parcours, avec un code de sortie.

**Independent Test** : quickstart US1, points 1 à 4, avec le seul parcours `005-us1-auth`.

- [X] T013 [US1] Créer `mobile/scripts/e2e.mjs` (runner), en suivant les étapes de [contracts/e2e-command.md](contracts/e2e-command.md) :
  - lire les arguments `--platform`, `--lang` et les fichiers de parcours, ainsi que `DEMO_PASSWORD`, `E2E_API_URL` (défaut `http://localhost:3010`) et `E2E_LANG` ;
  - vérifier les prérequis dans l'ordre du contrat, et sortir avec le code 2 et le message au premier manquant ;
  - régénérer `tmp/e2e/wishlist.json` : `node --import tsx scripts/create-demo-data.mjs <tmp>` lancé depuis la racine du dépôt, avec `DEMO_PASSWORD`, puis `rename` vers `tmp/e2e/wishlist.json` ;
  - vérifier le serveur : `GET <url>/api/v1/capabilities` répond 200 ;
  - vérifier que le serveur lit ce fichier (R3) : `POST /api/v1/auth/login` avec `alex@example.test`, relire `tmp/e2e/wishlist.json`, vérifier qu'une `apiSessions` de plus existe pour `demo-owner`, puis `POST /api/v1/auth/logout` avec le jeton reçu (forme des requêtes : `specs/004-mobile-api/contracts/openapi.yaml`) ;
  - Android : `adb -s <id> reverse tcp:<port> tcp:<port>` (R10) ;
  - écrire `mobile/.maestro/scripts/strings.generated.js` pour la langue résolue ;
  - lancer `maestro test --device <id> --format junit --output <dir>/report.xml --test-output-dir <dir> -e DEMO_PASSWORD=<…>`, sur iOS avec `--exclude-tags android-only`, sur `.maestro/` ou sur les fichiers donnés, avec `stdio: "inherit"` ;
  - lire `report.xml`, puis afficher et écrire `<dir>/summary.txt` avec `formatSummary`. Les parcours exclus sur iOS (tag `android-only`, lu dans l'en-tête des fichiers) apparaissent « non joué : le simulateur iOS ne permet pas de couper le réseau de l'app » ;
  - sortir avec `exitCode`.

  `<dir>` vaut `tmp/e2e/results/<AAAAMMJJ-HHMMSS>-<ios|android>/`, à la racine du dépôt. Le mot de passe n'apparaît jamais dans la sortie ni dans `summary.txt`.
- [X] T014 [US1] Dans `mobile/app/(auth)/register.tsx`, poser `register.screen`, `register.name`, `register.email`, `register.password`, `register.submit`, `register.error` et `register.sent-continue`. Dans `mobile/app/(app)/account.tsx`, poser `account.screen`, `account.logout` et, dans la confirmation de déconnexion, `account.logout-confirm` (transmettre `testID` dans `mobile/src/ui/ConfirmDialog.tsx` si besoin).
- [X] T015 [US1] Créer `mobile/.maestro/subflows/register.yaml` : `runScript: ../scripts/unique.js`, puis inscription avec le nom `NAME` (défaut `E2E ${output.unique}`), l'adresse `e2e-${output.unique}@example.test` et `${DEMO_PASSWORD}`. Poser `output.email`, puis attendre `id: lists.screen`.
- [X] T016 [US1] Créer `mobile/.maestro/flows/005-us1-auth.yaml` (tag `005-us1`), d'après l'Independent Test de la 005-US1 et les parcours jetables `tmp/maestro/us1-us2*.yaml` :
  - mauvais mot de passe pour `alex@example.test` → `assertVisible` du message `${output.t.auth.<clé de l'erreur de connexion>}` ; vérifier qu'il ne dit pas lequel des deux champs est faux ;
  - connexion d'Alex → `lists.screen` ;
  - « Mon compte » → déconnexion → `login.screen` ;
  - création de compte par `register.yaml` → `lists.screen` et `lists.empty` ;
  - création de compte avec `alex@example.test` → message « vérifiez vos e-mails », sans connexion.
- [ ] T017 [US1] Lancer `npm --prefix mobile run e2e` sur le simulateur iOS, puis sur l'émulateur Android (quickstart US1, points 1 à 4, avec ce seul parcours). Corriger le runner ou le parcours jusqu'à ce qu'ils passent trois fois de suite sur chaque plateforme. Vérifier aussi les cinq prérequis manquants du quickstart (code 2, message).

**Checkpoint** : la mécanique complète marche sur les deux plateformes avec un parcours.

---

## Phase 4: User Story 2 - Lancer un parcours seul (Priority: P1)

**Goal** : chaque parcours tourne seul, sur une app vide, deux fois de suite, dans n'importe quel ordre.

**Independent Test** : quickstart US2.

- [X] T018 [US2] Dans `mobile/scripts/e2e.mjs`, accepter des chemins de parcours relatifs à `mobile/` ou absolus, refuser un chemin qui n'existe pas (code 2), et ne jouer que ceux-là. Le résumé ne liste que les parcours demandés ; un parcours `android-only` demandé sur iOS apparaît « non joué ».
- [X] T019 [US2] Créer `mobile/.maestro/subflows/create-list.yaml` : entrée `TITLE`. Depuis `lists.screen`, appuyer sur `lists.new`, saisir `new-list.title`, puis `new-list.submit`, et attendre `id: list.screen`. Poser dans `mobile/app/(app)/lists/new.tsx` les identifiants `new-list.screen`, `new-list.title`, `new-list.subtitle`, `new-list.person`, `new-list.submit` et `new-list.error`, et `list.screen` dans `mobile/app/(app)/lists/[listId]/index.tsx`.
- [X] T020 [US2] Créer `mobile/.maestro/flows/005-us2-lists.yaml` (tag `005-us2`) :
  - Alex voit `` lists.card-demo-list `` ;
  - nouvelle liste « Noël ${output.unique} » par `create-list.yaml` → la liste s'ouvre ;
  - retour à « Mes listes » → la carte est là ;
  - titre vide → message d'erreur du site (`${output.t.<ns>.<clé>}`), rien n'est créé.
- [X] T021 [US2] Vérifier la quickstart US2 : `006-us1` (une fois écrit) ou `005-us2`, deux fois de suite ; `005-us1` lancé après une connexion manuelle de Camille repart de `login.screen`.

**Checkpoint** : deux parcours, chacun autonome.

---

## Phase 5: User Story 3 - Couvrir les parcours des features 005 et 006 (Priority: P2)

**Goal** : chaque story des features 005 et 006 a son parcours ou une exclusion justifiée.

**Independent Test** : quickstart US3, et la suite complète passe sur les deux plateformes.

### Tests

- [X] T022 [P] [US3] Écrire `mobile/__tests__/e2e/coverage.test.ts` :
  - lire les titres `### User Story N` de `specs/005-mobile-list-app/spec.md` et de `specs/006-mobile-legal-account/spec.md` ;
  - lire les `tags` des fichiers de `mobile/.maestro/flows/*.yaml` (lecture ligne à ligne, sans dépendance YAML si `yaml` n'est pas déjà dans `mobile/node_modules`) ;
  - lire la colonne « Story » de `mobile/.maestro/exclusions.md` ;
  - échouer en nommant chaque story (`005-us6`…) qui n'a ni parcours tagué ni ligne « story entière » ;
  - échouer aussi si un parcours n'a pas exactement un tag de story.

### Identifiants et parcours (un parcours par story ; [P] entre stories, les écrans touchés sont distincts)

- [X] T023 [P] [US3] **005-US3** :
  - dans `mobile/app/(app)/lists/[listId]/items/new.tsx`, `items/[itemId].tsx` et le formulaire qu'ils partagent (`mobile/src/features/…`), poser `item-form.screen`, `item-form.name`, `item-form.price`, `item-form.price-error`, `item-form.category`, `item-form.person`, `item-form.url`, `item-form.prefill`, `item-form.submit`, `item-form.archive`, `item-form.delete` et `item-form.delete-confirm` ;
  - poser `list.add-item` et `` list.item-${item.id} `` dans `lists/[listId]/index.tsx`, `archives.screen` et `archives.restore` dans `archives.tsx`, `reservations.screen` dans `reservations.tsx`, et `settings.screen`, `settings.category-new` et `settings.category-add` dans `settings.tsx` ;
  - créer `mobile/.maestro/flows/005-us3-items.yaml` (tag `005-us3`), sur une liste créée par `create-list.yaml` :
    - ajouter « Puzzle ${output.unique} » à 24,90 → visible dans la liste ;
    - prix « abc » → `item-form.price-error` visible, avec le message de `locales/` ; le nom saisi est toujours là ;
    - modifier le nom → nouveau nom visible ;
    - archiver → visible dans l'onglet Archives (`tab-<key>`) ; désarchiver ;
    - supprimer avec confirmation → absent ;
    - `item-form.prefill` absent (aucun service de préremplissage configuré) ;
    - Réglages : ajouter une catégorie ;
    - avec Alex sur « Nos envies toute l'année », l'onglet Réservations montre la réservation de démo de « Morgan ».
- [X] T024 [P] [US3] **005-US4** :
  - dans `mobile/app/(app)/lists/[listId]/share.tsx`, poser `share.screen`, `share.share`, `share.read-link`, `share.copy` et `share.copied` ;
  - créer `mobile/.maestro/flows/005-us4-share.yaml` (tag `005-us4`), avec Alex sur `demo-list` :
    - l'onglet Partage montre `qr-code` ;
    - `share.read-link` contient `/l/demo-list-lecture` et jamais `demo-list-invitation` ;
    - `share.copy` → `share.copied` visible ;
    - `share.share` ouvre la feuille de partage : la refermer (`back` sur Android, bouton de fermeture du système sur iOS, sous condition de plateforme).
- [ ] T025 [P] [US3] **005-US5** :
  - créer `mobile/.maestro/flows/005-us5-offline.yaml` (tags `005-us5` et `android-only`), avec Alex :
    - ouvrir `demo-list` en ligne ;
    - `setAirplaneMode: enabled` → `offline-banner` visible ;
    - ajouter deux idées « Hors ligne A/B ${output.unique} » → visibles avec `pending-badge` ;
    - `stopApp` puis `launchApp` sans `clearState` → idées et badges toujours là ;
    - `setAirplaneMode: disabled` → les `pending-badge` disparaissent (`extendedWaitUntil`) ;
    - tirer pour rafraîchir → chaque idée apparaît une seule fois ;
  - vérifier le point de R9 : pendant le mode avion, `adb reverse` laisse-t-il la file envoyer ? Si oui, documenter dans le parcours et dans `mobile/.maestro/README.md` le repli `E2E_API_URL=http://10.0.2.2:3010` pour Android (le runner saute alors `adb reverse` quand l'hôte est `10.0.2.2`), et le mettre en œuvre dans `mobile/scripts/e2e.mjs`.
- [X] T026 [P] [US3] **006-US1** :
  - dans `mobile/app/(app)/account.tsx`, poser `account.delete` ; dans `mobile/app/(app)/delete-account.tsx`, poser `delete-account.screen`, `delete-account.summary`, `delete-account.password`, `delete-account.confirm`, `delete-account.cancel` et `delete-account.error` ;
  - créer `mobile/.maestro/flows/006-us1-delete-account.yaml` (tag `006-us1`) :
    - créer son compte par `register.yaml`, puis une liste par `create-list.yaml` ;
    - « Mon compte » → `account.delete` → le résumé mentionne une liste supprimée ;
    - mauvais mot de passe → `delete-account.error` ;
    - bon mot de passe → `login.screen` avec le message `auth:account.deleted` ;
    - connexion avec `${output.email}` → message d'erreur de connexion.
- [X] T027 [P] [US3] **006-US2** :
  - poser `account.legal` et `account.privacy` dans `account.tsx`, et `legal-mentions.screen` et `legal-privacy.screen` dans `mobile/app/legal/mentions.tsx` et `privacy.tsx` ;
  - créer `mobile/.maestro/flows/006-us2-legal.yaml` (tag `006-us2`) :
    - depuis l'écran de connexion (sans compte), ouvrir les mentions légales s'il y a un accès (`login.legal`) ;
    - connecté avec Alex : « Mon compte » → mentions légales → titre `${output.t.content.legal.title}` ;
    - retour, puis politique de confidentialité → titre `${output.t.content.privacy.title}`.
- [X] T028 [P] [US3] **006-US3** :
  - poser `account.export` dans `account.tsx` ;
  - créer `mobile/.maestro/flows/006-us3-export.yaml` (tag `006-us3`) :
    - créer son compte par `register.yaml`, puis `account.export` ;
    - la feuille de partage du système s'ouvre : vérifier sa présence par un élément système stable, sous condition de plateforme, puis la refermer ;
    - de retour sur `account.screen`, aucune erreur affichée.
- [X] T029 [P] [US3] **006-US4** :
  - poser `account.licenses`, `account.contact` et `account.version` dans `account.tsx`, et `legal-licenses.screen` et `` legal-licenses.item-${name} `` dans `mobile/app/legal/licenses.tsx` ;
  - créer `mobile/.maestro/flows/006-us4-about.yaml` (tag `006-us4`) :
    - `account.version` contient la version de `mobile/app.config.ts` (`1.0.0`, passée par `-e APP_VERSION` depuis le runner, qui la lit dans `mobile/package.json` ou `app.config.ts`) ;
    - `account.licenses` → `legal-licenses.screen` → `legal-licenses.item-react-native` visible.

    Ajouter `-e APP_VERSION` au lancement de Maestro dans `mobile/scripts/e2e.mjs`.
- [X] T030 [US3] Créer `mobile/.maestro/exclusions.md`, le tableau de [data-model.md](data-model.md) (colonnes Story, Vérification, Raison, Où la faire), avec les lignes de R16. La ligne `005-us6` porte « story entière », de même que `005-us5` sur iOS (précisé « iOS »). Chaque ligne renvoie à la section du `quickstart.md` de la 005 ou de la 006.
- [ ] T031 [US3] Lancer la suite complète sur iOS puis sur Android, trois fois chacune (SC-001, SC-003). Résultat attendu : sur iOS 8 réussis et 1 non joué, sur Android 9 réussis ; moins de 15 min par exécution. Corriger les parcours qui échouent au hasard (attentes, sélecteurs), jamais par une attente à durée fixe.

**Checkpoint** : `coverage.test.ts` passe, la suite complète passe sur les deux plateformes.

---

## Phase 6: User Story 4 - Comprendre un échec (Priority: P2)

**Goal** : un échec nomme le parcours et l'étape, et laisse une capture de l'écran.

**Independent Test** : quickstart US4.

- [X] T032 [US4] Vérifier que Maestro écrit une capture à l'échec dans `--test-output-dir`. Sinon, ajouter `onFlowComplete` dans `mobile/.maestro/config.yaml`, ou une `takeScreenshot` conditionnelle documentée par Maestro. Dans `mobile/scripts/e2e.mjs`, après le résumé, afficher pour chaque parcours en échec le chemin de sa capture, trouvée dans `<dir>` par le nom du parcours.
- [ ] T033 [US4] Faire la régression volontaire de la quickstart US4 : renommer `item-form.submit`, rebuild, lancer `005-us3-items.yaml`, puis vérifier le résumé (étape visant `item-form.submit`), le code 1 et la capture. Annuler le renommage. Si le message JUnit de Maestro ne contient pas l'étape, compléter `parseJunit` (T007) avec la source qui la contient (journal du parcours dans `<dir>`) et son test (T004).

**Checkpoint** : SC-005 vérifié à la main.

---

## Phase 7: User Story 5 - Garder la suite à jour (Priority: P3)

**Goal** : la doc dit comment lancer la suite et impose un parcours par nouvelle story ; un `testID` renommé se voit sans simulateur.

**Independent Test** : quickstart US5, et `test-ids.test.ts` échoue sur un identifiant renommé.

- [X] T034 [P] [US5] Écrire `mobile/__tests__/e2e/test-ids.test.ts` :
  - lire tous les `id:` (valeur entre guillemets ou nue) de `mobile/.maestro/flows/*.yaml` et `subflows/*.yaml` ;
  - lire tous les `testID="…"`, `` testID={`…`} `` et `testID={"…"}` de `mobile/app/**/*.tsx` et `mobile/src/**/*.tsx` ;
  - un identifiant dynamique `` `lists.card-${…}` `` donne le préfixe `lists.card-` ; un `id:` de parcours correspond s'il est égal à un littéral ou commence par un préfixe déclaré ;
  - les identifiants posés par `Button` et `Card` (`<id>-box`) sont acceptés ;
  - échouer en nommant chaque `id:` sans correspondance, avec le fichier du parcours ;
  - vérifier aussi qu'aucun `testID` littéral ne contient `@` ni d'espace.
- [X] T035 [P] [US5] Créer `mobile/.maestro/README.md` :
  - les prérequis : Maestro, `DEMO_PASSWORD`, serveur avec `WISHLIST_DATA_PATH=tmp/e2e/wishlist.json` sur le port 3010, build Release avec `EXPO_PUBLIC_API_URL=http://localhost:3010` ;
  - la commande et ses options, en renvoyant à [contracts/e2e-command.md](contracts/e2e-command.md) pour le détail ;
  - les variables `DEMO_PASSWORD`, `E2E_API_URL` et `E2E_LANG`, avec la mention qu'elles ne servent qu'au runner, pas au serveur ;
  - comment écrire un parcours : en-tête, tags, `launch-clean`, `login`, `unique`, `id:`, textes via `output.t`, pas d'attente fixe ;
  - la convention des `testID` ;
  - où trouver les résultats ;
  - le lien vers `exclusions.md`.
- [X] T036 [US5] Mettre à jour `AGENTS.md` :
  - **Commandes** : ajouter la ligne de la suite e2e (`DEMO_PASSWORD=… npm --prefix mobile run e2e`, serveur sur `tmp/e2e/wishlist.json`, lien vers `mobile/.maestro/README.md`) ;
  - **Fichiers générés** : ajouter `mobile/.maestro/scripts/strings.generated.js` ;
  - **Variables d'environnement** : préciser que les variables du runner (`E2E_API_URL`, `E2E_LANG`) sont documentées dans `mobile/.maestro/README.md`, pas dans le `README.md`, `.env.example` ni `deploy/compose.prod.yml` (R15) ;
  - **Tests** : remplacer « Il n'y a pas de test e2e » par la suite Maestro de l'app mobile. Une user story de l'app mobile vient avec son parcours dans `mobile/.maestro/flows/` (tag `<feature>-usN`), ou une ligne dans `exclusions.md`. Le site n'a pas de test e2e, et un parcours réel du `quickstart.md` reste exigé (principe IV).
- [X] T037 [P] [US5] Dans `mobile/AGENTS.md`, ajouter sous « Commands » un renvoi vers `.maestro/README.md` et la règle `testID` (`<écran>.<élément>`).
- [X] T038 [P] [US5] Dans `specs/005-mobile-list-app/quickstart.md` et `specs/006-mobile-legal-account/quickstart.md`, ajouter en tête un paragraphe : la partie « dans l'app » de ces parcours est automatisée par `npm --prefix mobile run e2e`, et ce qui reste à faire à la main est listé dans `mobile/.maestro/exclusions.md`.

**Checkpoint** : `npm --prefix mobile test` passe ; la quickstart US5 est vérifiée.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T039 Lancer `npm --prefix mobile run lint && npm --prefix mobile run typecheck && npm --prefix mobile test`, et `npm run lint` à la racine (fichiers `.mjs` de `mobile/scripts/`, si l'eslint racine les couvre). Corriger.
- [X] T040 Vérifier que les `testID` ajoutés n'ont rien changé à l'apparence : les tests jest existants de `mobile/__tests__/` passent sans mise à jour de snapshot ; comparer à l'œil « Mon compte », le formulaire d'idée et l'écran de connexion avant et après (FR-017).
- [X] T041 Chercher dans `mobile/.maestro/` et `mobile/scripts/` tout mot de passe en clair, toute adresse qui ne finit pas par `@example.test` et tout texte d'interface en dur, avec `grep -rnE "password|@" mobile/.maestro mobile/scripts/e2e*`. `git status` après une exécution : rien hors de `tmp/` (quickstart US5, point 3).
- [ ] T042 Dérouler toute la [quickstart.md](quickstart.md) sur iOS puis sur Android, y compris la section « Langue » (simulateur en anglais) et « Prérequis manquants ». Noter les durées des exécutions complètes. Le dossier jetable `tmp/maestro/` peut ensuite être supprimé à la main : le proposer, sans le supprimer soi-même.

## Écarts à l'implémentation

- **Identifiants qui existaient déjà, gardés tels quels** (le jest de l'app s'en sert) : `open-account` au lieu de `lists.account`, `delete-account` au lieu de `account.delete`, `enrich` au lieu de `item-form.prefill`, `form-error` au lieu de `item-form.price-error`, et `copy-link` au lieu de `share.copy`. La liste à jour est dans [contracts/test-ids.md](contracts/test-ids.md).
- **Liens légaux sous la connexion** : `legal-links.mentions` et `legal-links.privacy`, posés dans `LegalLinks` (partagé par la connexion et l'inscription), au lieu de `login.legal`.
- **Bouton de préremplissage** : il est toujours affiché. Sans service configuré, il ne promet pas l'IA (`list:form.fetchInfos`). Le parcours 005-US3 vérifie l'absence du libellé IA.
- **`login.yaml` sans `PASSWORD`** : tous les comptes de la suite ont `DEMO_PASSWORD`. Le cas du mauvais mot de passe s'écrit dans le parcours.
- **Sous-parcours ajoutés** : `logout`, `add-item`, `open-category` et `close-share-sheet` ([data-model.md](data-model.md)).
- **Fonctions pures du runner en `.cjs`** (CommonJS) : jest-expo les charge sans transformation, et `e2e.mjs` les importe.
- **Validation sur appareil (31/10, iOS seulement)** : la suite complète passe sur le simulateur iOS (iPhone 17, iOS 26.5), avec 8 parcours réussis et 005-US5 non joué, en 11 min environ (`tmp/e2e/results/20261031-201207-ios`). Restent à faire : Android (T017, T025, T031), trois exécutions de suite (SC-003, T031), la régression volontaire (T033) et la quickstart complète (T042).
- **Ajustements trouvés sur le simulateur** :
  - en build Debug, `launch-clean` rouvre Metro par le lien du dev client (`E2E_METRO_URL`), confirme « Ouvrir » et ferme le menu développeur ;
  - les sous-parcours refusent « Enregistrer le mot de passe ? » ;
  - `register` ferme la feuille « mot de passe robuste » d'iOS par la position de sa croix ;
  - les formulaires se remplissent de bas en haut, pour que le clavier ne cache pas le champ suivant ;
  - `hideKeyboard` est facultatif ;
  - le prix invalide est « 1,234 » (ou « 1.234 » en anglais), car le pavé décimal ne tape pas de lettres ;
  - la feuille de partage d'iOS 26 se ferme par `PopoverDismissRegion`.
- **Dépendances de l'app** : `npx expo install --fix` (lancé avec accord) a réaligné les modules Expo. Avant, `ExpoFileSystem` attendait un symbole absent de `ExpoModulesJSI` 58.0.20 et l'app plantait au démarrage. Ce changement va avec le travail EAS, pas avec ce commit.
- **Identifiants prévus mais non posés** : aucun parcours n'en a besoin. Ce sont `archives.screen`, `reservations.screen`, `settings.screen` et `share.screen` (les onglets partagent `list.screen` et leur `tab-<key>`), `item-form.category`, `item-form.person` et `item-form.archive` (l'archivage se fait depuis la carte : `item-card.archive`), et `legal-licenses.item-<nom>` (006-US4 vérifie qu'une ligne « version · licence » est affichée, la liste étant trop longue pour aller jusqu'à `react-native`).
- **Corrections de la revue (règles et tests)** : 005-US1 joue aussi la réouverture sans ressaisie et le mot de passe oublié. 005-US2 vérifie le texte du titre vide et qu'aucune liste n'est créée. 005-US3 vérifie le refus de retirer une catégorie utilisée et le petit mot de la réservation. 005-US5 modifie une idée hors ligne et joue l'alerte de déconnexion. 006-US1 vérifie le texte de l'erreur et la réinscription. 006-US2 ouvre les deux pages sans compte. `launch-clean` coupe le mode avion sur Android. Le runner rattache les captures au parcours en échec. Sélection des parcours, parcours absents du rapport, `pickDevice` et format d'`exclusions.md` ont leurs tests. Les cas non joués sont dans `exclusions.md`.
- **Corrections de la revue (sécurité)** : le mot de passe passe à Maestro par l'environnement (`MAESTRO_DEMO_PASSWORD`, les parcours lisent `${MAESTRO_DEMO_PASSWORD}`) ; le runner n'accepte plus `10.0.2.2` ; `login.yaml` vérifie la liste de démo et `register.yaml` se connecte d'abord avec Alex, pour qu'une app pointée vers un autre serveur s'arrête avant toute écriture. Le repli `10.0.2.2` de T025 passe donc par le build de l'app, pas par `E2E_API_URL`.
- **Lint racine** : l'erreur `react-hooks/set-state-in-effect` dans `components/site/analytics-opt-out.tsx` existait avant la 007 et n'est pas traitée ici.

---

## Dependencies & Execution Order

### Phases

- **Setup (Phase 1)** : aucune dépendance.
- **Foundational (Phase 2)** : après Setup. Bloque toutes les stories.
- **US1 (Phase 3)** : après Foundational. C'est le MVP.
- **US2 (Phase 4)** : après US1 (runner T013 et `register.yaml` T015).
- **US3 (Phase 5)** : après US2 (`create-list.yaml` T019). T023 à T029 sont indépendantes entre elles.
- **US4 (Phase 6)** : après US1. Elle peut avancer en parallèle de US3, mais T033 a besoin de `005-us3-items.yaml` (T023).
- **US5 (Phase 7)** : T034, T035 et T037 dès US1 ; T036 et T038 après US3 (exclusions connues).
- **Polish (Phase 8)** : après toutes les stories.

### Dans une story

- Pour chaque parcours, poser les `testID` de ses écrans avant d'écrire le parcours.
- Le parcours est validé seul (`npm --prefix mobile run e2e -- <fichier>`) avant de passer au suivant.

## Parallel Example

```text
# Phase 2, en parallèle :
T004 runner.test.ts
T005 strings.mjs    T006 locale.mjs    T007 junit.mjs    T008 checks.mjs
T009 unique.js      T010 launch-clean.yaml    T011 login.yaml

# Phase 5, une story par agent (écrans distincts) :
T023 005-us3   T024 005-us4   T025 005-us5   T026 006-us1
T027 006-us2   T028 006-us3   T029 006-us4
# T026 à T029 touchent tous mobile/app/(app)/account.tsx : les enchaîner,
# ou poser d'abord tous les testID de account.tsx en une passe.
```

## Implementation Strategy

### MVP (US1)

Phases 1 à 3 : le runner complet et un parcours (`005-us1-auth`), sur iOS et sur Android. La mécanique est alors prouvée : prérequis, base, textes, résumé, codes de sortie.

### Incrémental

1. US2 : un deuxième parcours et l'exécution d'un seul parcours.
2. US3 : un parcours par story, chacun livré et vérifié seul, puis `exclusions.md` et le test de couverture.
3. US4 : rapport d'échec et régression volontaire.
4. US5 : garde-fou des identifiants et doc.
