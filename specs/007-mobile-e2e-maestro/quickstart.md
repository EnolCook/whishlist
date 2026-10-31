# Quickstart : valider la suite e2e de l'app mobile

Ces parcours vérifient la suite elle-même (principe IV). Ils se font une fois sur le **simulateur iOS** et une fois sur l'**émulateur Android**. La commande et ses sorties sont décrites dans [contracts/e2e-command.md](contracts/e2e-command.md).

## Prérequis

```bash
# Maestro (hors dépôt)
curl -Ls https://get.maestro.mobile.dev | bash
maestro --version                      # 2.x

export DEMO_PASSWORD='demo-password-1'

# Serveur local sur la base de la suite (le runner la régénère à chaque exécution)
npm ci
npm run demo:data -- tmp/e2e/wishlist.json
WISHLIST_DATA_PATH=tmp/e2e/wishlist.json SESSION_SECRET=dev-secret-dev-secret-dev-secret-00 \
  npm run dev -- --port 3010
# sans GEMINI_API_KEY ni OPENAI_API_KEY : le préremplissage est absent, ce que vérifie 005-US3

# App, build Release pointé sur ce serveur
npm --prefix mobile ci
(cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3010 npx expo run:ios --configuration Release)
# Android : (cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3010 npx expo run:android --variant release)
```

## US1 : toute la suite d'une commande

1. Lancer `npm --prefix mobile run e2e` avec le simulateur iOS seul démarré. Les 9 parcours s'affichent : 8 réussis, et `005 US5` « non joué » avec sa raison. Le code de sortie est 0 (`echo $?`).
2. Refaire avec l'émulateur Android seul démarré : les 9 parcours sont réussis, `005 US5` compris.
3. Démarrer les deux appareils, puis lancer sans `--platform` : le runner s'arrête avant le premier parcours avec « Plusieurs appareils : précisez --platform », code 2.
4. Ajouter à la main une idée à « Nos envies toute l'année » dans l'app, puis relancer la suite : même résultat qu'en 1, et l'idée ajoutée a disparu (base régénérée).
5. Lancer la suite trois fois de suite sur la même plateforme : trois fois le même résultat (SC-003). Noter la durée affichée : moins de 15 min (SC-001).

## US2 : un parcours seul

1. `npm --prefix mobile run e2e -- .maestro/flows/006-us1-delete-account.yaml`, deux fois de suite : réussi les deux fois. Chaque exécution a créé et supprimé son propre compte `e2e-…@example.test`.
2. Lancer chaque parcours seul, dans un ordre différent de celui de la suite : chacun donne le même résultat que dans la suite (SC-004).
3. Se connecter à la main avec Camille dans l'app, puis lancer `005-us1-auth.yaml` : le parcours repart de l'écran de connexion, sans rester connecté avec Camille.

## US3 : couverture

1. Ouvrir [`mobile/.maestro/exclusions.md`](../../mobile/.maestro/exclusions.md). Chaque story des specs 005 et 006 a un parcours dans `flows/` (tag `005-usN` / `006-usN`), ou une ligne « story entière » (005-US6). Chaque vérification manuelle renvoie à son `quickstart.md`.
2. `npm --prefix mobile test` : `coverage.test.ts` passe. Ajouter un faux `### User Story 9` dans une copie locale de la spec 005, sans le commiter : le test échoue et nomme la story.

## US4 : comprendre un échec

1. Dans `mobile/app/(app)/lists/[listId]/items/new.tsx` (ou le formulaire), renommer à la main `item-form.submit` en `item-form.submit-x`, puis relancer le build. Lancer `005-us3-items.yaml`.
2. Le résumé affiche `✗ 005 US3` avec l'étape qui vise `item-form.submit`, et le code de sortie vaut 1.
3. Le dossier `tmp/e2e/results/<horodatage>-<plateforme>/` contient la capture de l'écran au moment de l'échec, rangée sous le parcours. Elle permet de trouver l'écran fautif en moins de 2 min (SC-005).
4. `npm --prefix mobile test` : `test-ids.test.ts` échoue aussi et nomme `item-form.submit`. Annuler le renommage.

## Prérequis manquants (FR-012)

Chaque cas s'arrête avant le premier parcours, avec un message qui dit quoi faire, et sort avec le code 2 :

- sans `DEMO_PASSWORD` ;
- serveur arrêté ;
- serveur lancé sur `tmp/demo-wishlist.json` au lieu de `tmp/e2e/wishlist.json` ;
- `E2E_API_URL=https://ohyoushouldnt.app` ;
- app désinstallée du simulateur.

## Langue

Passer le simulateur en anglais, puis relancer la suite : même résultat. Le résumé indique `en`, et les messages vérifiés sont ceux de `locales/en/`.

## US5 : doc

1. `AGENTS.md` donne la commande e2e, ses prérequis et ses variables (`DEMO_PASSWORD`, `E2E_API_URL`, `E2E_LANG`), avec la règle « une user story de l'app mobile = un parcours ». La phrase « Il n'y a pas de test e2e » a disparu.
2. Les `quickstart.md` des features 005 et 006 renvoient à la suite et à `exclusions.md`.
3. `git status` après une exécution : aucun fichier nouveau hors de `tmp/`. `strings.generated.js` est ignoré.
