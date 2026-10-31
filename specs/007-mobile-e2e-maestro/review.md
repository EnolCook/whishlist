# Revue de code

Revue complète du 31/10/2026. Hors revue, car venant du travail EAS en cours : `mobile/app.config.ts`, `mobile/eas.json`, `mobile/.gitignore`, et dans `mobile/package.json` tout sauf le script `e2e`.

## Fichiers relus

```text
91cece39a8c660e27ebf2d178addd3a3a6245c6a  .gitignore
a6a3a1218b520dde6c612a0f1648562c44aa3bdb  mobile/.maestro/config.yaml
28dd70df19275181b445bf7ba37494a1e190d57c  mobile/.maestro/flows/005-us1-auth.yaml
95c40068e8c2a3d00d833be96a043d9034c88815  mobile/.maestro/flows/005-us2-lists.yaml
6b821ef7fcb6ae7ab965d080a8301d2042e307f9  mobile/.maestro/flows/005-us3-items.yaml
c7d4e9b9f66af1092c87a38abcf9dafdb227aa94  mobile/.maestro/flows/005-us4-share.yaml
9a3e283ba2187aa239e5cfafd9f56fe494b74f63  mobile/.maestro/flows/005-us5-offline.yaml
d6fe7683045d408cd07fcdedfe42b9ec53a8088b  mobile/.maestro/flows/006-us1-delete-account.yaml
6fa239079c5fef9ee120dfaa7416ba89e10813bf  mobile/.maestro/flows/006-us2-legal.yaml
66369c424b49edd04e406b7014e23e9bc9d64515  mobile/.maestro/flows/006-us3-export.yaml
6522fd96b91c7c6067677c595ca2c131fba721e4  mobile/.maestro/flows/006-us4-about.yaml
475a89b860dd898620272b856fbfc1a68aded57d  mobile/.maestro/scripts/unique.js
83dd0c90deb9288ef1a9af3cf6dff78e3aa0e239  mobile/.maestro/subflows/add-item.yaml
c0535f8a09df2a3483e60683a9ff23afe4fb9156  mobile/.maestro/subflows/close-share-sheet.yaml
e1162e6cb90eb938a7e3018db6eb9caadac535fc  mobile/.maestro/subflows/create-list.yaml
e24f90e1c77b783cf9e1f0342fb17b20605a723b  mobile/.maestro/subflows/fill-new-list.yaml
3b9fd06534604feca4f4e2da5ea4f35b96c6f574  mobile/.maestro/subflows/launch-clean.yaml
24910b9a2e45b2d9f0b73ab0e6e240db5a5bcdb5  mobile/.maestro/subflows/login.yaml
ea648150b04338a3238b604f64081678a475f37c  mobile/.maestro/subflows/logout.yaml
bb785a2de29b0d96dde9c4a9a380fb305a1a5b10  mobile/.maestro/subflows/open-category.yaml
c67af0915549e2084e9d02f8d63fa7b12324080b  mobile/.maestro/subflows/open-new-item.yaml
b810c2228d9d05f894837f287402a085b49a651b  mobile/.maestro/subflows/register.yaml
7c11f9fca2a469687e125f4a5f53b2c84a037dbb  mobile/.maestro/subflows/submit-item-form.yaml
dbbbdbbabff35ffa3b167ed99989c2e50776c1ea  mobile/.maestro/subflows/submit-login.yaml
8169c2216e05987197827bbed1d95fa27f36783c  mobile/.maestro/subflows/submit-new-list.yaml
b3a88fd7f67686b446ec724176f4459fc68a697c  mobile/.maestro/subflows/submit-register.yaml
56521ebc4b5104afb3cef144aa1c0dc9f730819e  mobile/__tests__/e2e/coverage.test.ts
e2b23d921b04727f992515a2bd2f6b567c592491  mobile/__tests__/e2e/runner.test.ts
61862b590ed641486934ee306e1ad2e9720380f3  mobile/__tests__/e2e/test-ids.test.ts
46b009253dfc8dad2bf022e5dbadc605151e853d  mobile/app/(app)/account.tsx
ab1c3ca22ea8adc66cdb1360ae6d581fbcaa1fb8  mobile/app/(app)/delete-account.tsx
d7f5b45a2c6901f678458d8ec57c5e9cc45c339d  mobile/app/(app)/index.tsx
9b86e4cda338df79cc641c75485b17cbef0060b8  mobile/app/(app)/lists/[listId]/archives.tsx
4584c36ef9ba909bc8ca8faec63565d2f1c085bb  mobile/app/(app)/lists/[listId]/index.tsx
e8e38f50fdcd378d80a86a77f92e723c2a755edb  mobile/app/(app)/lists/[listId]/items/[itemId].tsx
296d59ce382ce249c549967da70a226ba58fe8e7  mobile/app/(app)/lists/[listId]/items/new.tsx
9e072781202820dce2b317b232cee65dfccb7240  mobile/app/(app)/lists/[listId]/reservations.tsx
e4d080e2b853c0be048afce9f7122c487b5f4793  mobile/app/(app)/lists/[listId]/share.tsx
81b4d1388fa7566a7bc33bf7018cd86b67029b4a  mobile/app/(app)/lists/new.tsx
0f943e657901ff28691b654cb09704dc5469bdd8  mobile/app/(auth)/login.tsx
353a4f136a7038862b9bb7a625a6ff3b18e2a55a  mobile/app/(auth)/register.tsx
3f69e5569559d8ac90f0caa22aaa9c005a9473cd  mobile/app/legal/licenses.tsx
85c4dfafc623cddd23501deb2431f24ba6bc1643  mobile/app/legal/mentions.tsx
bc112233b0b1fbdfaaec56949ea7d0f18cf83f29  mobile/app/legal/privacy.tsx
a8d3a166e54da77d3fdf9a2aade3e6d00fea7c9e  mobile/package.json
d50d7b157c834e24c05dde001737cf5fcffa03ba  mobile/scripts/e2e.mjs
ef34606588c43fe27d9f991963b06a37885f54cb  mobile/scripts/e2e/checks.cjs
107d23f564e68cdb741fbe4e9d537e2edc825092  mobile/scripts/e2e/flows.cjs
7fc3aa4b4450b5761107c4c307b3d629fc22a1d3  mobile/scripts/e2e/junit.cjs
4c0afb7fcb1fb62910eafc29bb64b43c7138c229  mobile/scripts/e2e/locale.cjs
f7adfd15a34bf6ead97e02a1ced81b91fd66f027  mobile/scripts/e2e/strings.cjs
dcfa4825ddc4bb8e5ba1dc629139a8ae42bb3de7  mobile/src/features/account/AuthLayout.tsx
947a0e5e162e7922f5e77693f6bdb017cfb35d74  mobile/src/features/account/LegalLinks.tsx
c9e6925530319c180ae37c45415ebb2a888d54d2  mobile/src/features/account/LegalScreen.tsx
bf2371141d9868558ce504655b18633172f7401b  mobile/src/features/items/IdeasAccordion.tsx
b5d021d3a137cb119e7f9b27fd5c607c2657f1a9  mobile/src/features/items/ItemCard.tsx
afb8c5f4f2acab04676883bbab06fc296da1a9ff  mobile/src/features/items/ItemForm.tsx
d3ee5e74312d203cadc7e14e766db7e506c223ef  mobile/src/features/lists/LabelEditor.tsx
daf3da167a366bbfe3c4230a7e7fb46671cd4ad1  mobile/src/features/lists/ListScreen.tsx
ca71b8ede655f9deebe1694dcb70c986b4957172  mobile/src/ui/BackLink.tsx
81561d76ffc51d30bf1b6f592b3bf99374ba355c  mobile/src/ui/ConfirmDialog.tsx
01ea45808646c356e78f43220f0a0740b0e5eb58  mobile/src/ui/Empty.tsx
6a8ce93be1001036ba35c826d829e2772b20f556  mobile/src/ui/Field.tsx
614990fdb6e2bb13879ad4859f64a5046b2e3103  mobile/src/ui/Screen.tsx
```

## Règles métier et tests

- [x] mobile/scripts/e2e.mjs:204 — Maestro est lancé avec `stdio: "inherit"` et affiche ses commandes avec les variables remplacées : le mot de passe peut sortir dans le terminal, et `failedStep` passe sans masquage dans `summary.txt` (contrat e2e-command, FR-014). Correction : filtrer la sortie de Maestro et `failedStep` en remplaçant la valeur de `DEMO_PASSWORD` par `***`, avec un test du masquage. Non corrigé : vérifié, le mot de passe n'apparaît pas dans le terminal, seulement dans les journaux locaux de Maestro (tmp/e2e/results, ignoré par git, et ~/.maestro), et c'est le mot de passe de test des comptes fictifs d'une base jetable, déjà dans les quickstarts.
- [ ] mobile/.maestro/subflows/launch-clean.yaml:6 — Si 005-us5 s'arrête entre `setAirplaneMode: enabled` et `disabled`, l'émulateur reste en mode avion et les parcours suivants échouent (FR-004, cas limite « parcours interrompu »). Correction : `setAirplaneMode: disabled` sous `when: platform: Android` avant `launchApp`.
- [ ] mobile/.maestro/subflows/close-share-sheet.yaml:19 — Sur Android, la seule preuve d'ouverture de la feuille est `notVisible: share.share`, toujours vraie depuis « Mon compte » : 006-US3 ne prouve rien sur Android (T028). Correction : attendre un élément du sélecteur Android avant `back`.
- [ ] mobile/__tests__/e2e/test-ids.test.ts:42 — Le test accepte `ShareSheet.RemoteContainerView`, `PopoverDismissRegion` et `xmark`, alors que contracts/test-ids.md dit « Seule exception : `Close` ». Correction : mettre le contrat à jour.
- [ ] mobile/.maestro/flows/005-us2-lists.yaml:49 — Titre vide : seul `new-list.error` est vérifié, ni son texte (scénario 005-US2-4, T020) ni l'absence de création. Correction : vérifier le texte par `output.t` et que « Mes listes » n'a pas de nouvelle carte.
- [ ] mobile/.maestro/flows/005-us1-auth.yaml:31 — La réouverture sans ressaisie (Independent Test, scénario 5) et le mot de passe oublié (scénario 9) se jouent dans l'app mais sont exclus ou absents ; le changement de mot de passe obligatoire (scénario 7) n'est ni joué ni exclu (FR-009). Correction : ajouter réouverture et mot de passe oublié au parcours, et une exclusion pour le scénario 7.
- [ ] mobile/.maestro/flows/005-us3-items.yaml:159 — Refus de retirer une catégorie utilisée (scénario 005-US3-5) et petit mot de la réservation (scénario 6) ni joués ni exclus. Correction : les jouer, ou les ajouter à exclusions.md.
- [ ] mobile/.maestro/flows/005-us5-offline.yaml:27 — Pas de modification d'idée hors ligne (Independent Test) ; l'alerte de déconnexion avec changements en attente (scénario 8) n'est ni jouée ni exclue (T025, FR-009). Correction : modifier une idée hors ligne et jouer la déconnexion jusqu'à `account.logout-confirm-keep`.
- [ ] mobile/.maestro/flows/006-us1-delete-account.yaml:69 — Réinscription avec la même adresse (scénario 6) et alerte des changements en attente (scénario 9) ni jouées ni exclues ; texte de l'erreur de mot de passe non vérifié (scénario 4). Correction : réinscrire `${output.email}` et vérifier `lists.empty`, vérifier le texte par `output.t`, et jouer ou exclure le scénario 9.
- [ ] mobile/.maestro/flows/006-us2-legal.yaml:11 — Sans compte, seule la page des mentions est ouverte (`legal-links.privacy` jamais utilisé) ; le cas sans réseau (scénario 5) n'est ni joué ni exclu. Correction : ouvrir aussi la page données personnelles, et jouer (Android) ou exclure le cas hors ligne.
- [ ] mobile/.maestro/exclusions.md:14 — 005-US4-4 (rappel du mot de passe de lecture) et les cas hors ligne 005-US4-9, 006-US3-4 et 006-US4-2 ne sont ni joués ni exclus (FR-009). Correction : les jouer ou les ajouter avec leur raison.
- [ ] mobile/.maestro/flows/006-us4-about.yaml:30 — T029 (coché) demande `legal-licenses.item-${name}` et la vérification de react-native : identifiant non posé, écart non écrit. Correction : poser l'identifiant, ou écrire l'écart dans tasks.md et contracts/test-ids.md.
- [ ] specs/007-mobile-e2e-maestro/tasks.md:164 — T023/T024 cochés, mais `archives.screen`, `reservations.screen`, `settings.screen`, `share.screen`, `item-form.category`, `item-form.person` et `item-form.archive` n'existent pas et ne sont pas dans les écarts. Correction : les ajouter à « Écarts à l'implémentation ».
- [ ] mobile/scripts/e2e.mjs:224 — T032 : les captures ne sont pas rattachées au parcours en échec, toutes les `.png` du dossier sont listées. Correction : filtrer par dossier du parcours et les afficher sous sa ligne `✗`.
- [ ] mobile/scripts/e2e.mjs:49 — `resolveFlows` (chemin introuvable → code 2), `readFlowHeader` (`android-only` → non joué) et « absent du rapport → échec » n'ont pas de test. Correction : les déplacer dans un module `.cjs` et les tester dans runner.test.ts.
- [ ] mobile/__tests__/e2e/runner.test.ts:137 — `pickDevice` (messages du contrat FR-012) et les variantes `<error>` / `message="…"` de `parseJunit` ne sont pas testées. Correction : ajouter ces cas.
- [ ] mobile/__tests__/e2e/coverage.test.ts:32 — Le test ne vérifie pas que chaque ligne d'exclusions.md a une raison et un lien vers un `quickstart.md` (FR-009). Correction : le vérifier.

## Constitution et sécurité

- [x] mobile/scripts/e2e.mjs:192 — Le mot de passe de démo passe en argument de processus (`-e DEMO_PASSWORD=…`), visible avec `ps` (FR-014, secrets par l'environnement). Correction : le passer par l'environnement du processus (`MAESTRO_DEMO_PASSWORD`) et retirer le `-e`.
- [x] mobile/scripts/e2e/checks.cjs:6 — `isLocalApiUrl` accepte `10.0.2.2` : depuis le Mac, c'est une IP du réseau local, et `checkServer` y envoie identifiants et mot de passe (R4). Correction : ne garder que `localhost` et `127.0.0.1` pour le runner.
- [x] mobile/scripts/e2e/checks.cjs:74 — `isAppInstalled` ne vérifie que l'identifiant, commun au build de production : avec une app pointée sur la prod, les parcours créeraient et supprimeraient des comptes `e2e-*` en production (R4, principe I). Correction : commencer la suite par une preuve que l'app parle au serveur local (compte ou marqueur présent seulement dans `tmp/e2e/wishlist.json`).

## Duplication

- [x] mobile/.maestro/flows/005-us1-auth.yaml:47 — Le bloc « adresse déjà utilisée » recopie `subflows/register.yaml`. Correction : `register.yaml` avec NAME/EMAIL facultatifs et sans attente finale imposée.
- [x] mobile/.maestro/flows/005-us1-auth.yaml:12 — La saisie du formulaire de connexion recopie `login.yaml` (aussi dans 006-us1-delete-account.yaml:70). Correction : sous-parcours `submit-login.yaml` (EMAIL, PASSWORD), appelé par `login.yaml` et ces deux endroits.
- [x] mobile/.maestro/flows/005-us2-lists.yaml:34 — Recopie le remplissage de `create-list.yaml`. Correction : sous-parcours de remplissage sans attente finale, appelé par `create-list.yaml` et ici.
- [x] mobile/.maestro/flows/005-us3-items.yaml:40 — L'envoi du formulaire d'idée est recopié trois fois et existe dans `add-item.yaml`. Correction : sous-parcours `submit-item-form.yaml`.
- [x] mobile/__tests__/e2e/coverage.test.ts:14 — `tagsOf` recopie la lecture des tags de `readFlowHeader` (e2e.mjs). Correction : module `scripts/e2e/flows.cjs` partagé.
- [x] mobile/scripts/e2e.mjs:78 — `stamp` redéfinit `pad` de junit.cjs. Correction : exporter `pad` et le réutiliser.

## Conventions

- [x] mobile/scripts/e2e/strings.cjs:30 — `@returns {Record<string, any>}` : un `any` qui fait compiler runner.test.ts (typage strict). Correction : type récursif `Strings`.
- [x] mobile/src/ui/BackLink.tsx:20 — Le testID `back` ne suit pas la forme `<écran>.<élément>` (AGENTS.md). Correction : `back-link.back` et mise à jour des parcours.

## i18n

Aucun point.
