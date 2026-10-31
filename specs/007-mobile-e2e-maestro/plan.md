# Implementation Plan: Suite de tests de bout en bout pour l'app mobile

**Branch**: `007-mobile-e2e-maestro` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-mobile-e2e-maestro/spec.md`

## Summary

Une suite Maestro versionnée dans `mobile/.maestro/`, avec un parcours par user story des features 005 et 006, se lance par `npm --prefix mobile run e2e`. Le runner (`mobile/scripts/e2e.mjs`, Node sans dépendance) :

1. vérifie les prérequis ;
2. régénère la base `tmp/e2e/wishlist.json` et vérifie que le serveur local la lit ;
3. génère les textes attendus depuis `locales/` dans la langue de l'appareil ;
4. lance Maestro, puis affiche un résumé par parcours.

Chaque parcours repart d'une app vide (`clearState` et `clearKeychain`), se connecte par un sous-parcours partagé, et crée lui-même les données qu'il détruit. L'app ne gagne que des `testID`, sans changement visible. Deux tests jest gardent la suite à jour (identifiants existants, couverture des stories). `AGENTS.md` remplace « pas de test e2e » par la règle « une user story de l'app mobile = un parcours ».

## Technical Context

**Language/Version** : parcours en YAML Maestro, avec de petits scripts JS lancés par Maestro (`runScript`). Runner en Node ≥ 20 (ESM, `.mjs`), comme `mobile/scripts/licenses.mjs`. App : Expo SDK 58, React Native 0.88 (inchangés).

**Primary Dependencies** : Maestro CLI 2.x, installé hors du dépôt (R1). Aucune nouvelle dépendance npm, ni dans l'app ni dans le site.

**Storage** : `tmp/e2e/wishlist.json`, régénéré à chaque exécution par `scripts/create-demo-data.mjs` (R3). Résultats dans `tmp/e2e/results/<horodatage>-<plateforme>/` (R12). Les deux sont sous `tmp/`, ignoré par git.

**Testing** : la suite elle-même, plus jest dans `mobile/__tests__/e2e/` : identifiants des parcours, couverture des stories, fonctions pures du runner (R14). Parcours de validation : [quickstart.md](quickstart.md).

**Target Platform** : simulateur iOS et émulateur Android sur la machine de développement, avec un build local Release pointé sur `http://localhost:3010` (R11).

**Project Type** : outillage de test d'une app mobile existante.

**Performance Goals** : suite complète en moins de 15 min sur une plateforme (SC-001). Aucune attente à durée fixe : `extendedWaitUntil` et les attentes implicites de Maestro.

**Constraints** :

- Le serveur n'est pas lancé par la suite, à cause du verrou de `next dev` (R2), et il doit être local (R4).
- La limite de débit n'est pas modifiée (R4).
- Aucun mot de passe en clair dans le dépôt (R15).
- Les `testID` ajoutés ne changent ni l'apparence ni le comportement de l'app (FR-017).

**Scale/Scope** :

- 9 parcours (005-US1 à US5, 006-US1 à US4) et 4 sous-parcours.
- Une vingtaine d'écrans reçoivent des `testID` ([contracts/test-ids.md](contracts/test-ids.md)).
- Un runner, deux tests de garde-fou, la doc.

Aucune inconnue restante : voir [research.md](research.md) (R1 à R16).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Règle | Statut | Pourquoi |
|-------|--------|----------|
| I. Données personnelles hors dépôt | ✅ | Comptes `@example.test` seulement. `DEMO_PASSWORD` est lu dans l'environnement et passé à Maestro par `-e`. Base, captures et textes générés sont sous `tmp/` ou ignorés par git. |
| II. Lecture sans compte, écriture par les membres | ✅ | Aucune règle d'accès modifiée ; les parcours exercent celles qui existent. |
| III. Réservation sans collision | ✅ | Non concerné : aucune règle de réservation modifiée. |
| IV. Tranches testables | ✅ | Les parcours automatisent la partie « dans l'app » des parcours réels. Les `quickstart.md` restent la preuve d'une tranche, avec la liste d'exclusions pour ce qui sort de l'app (R16). Chaque story de la 007 se livre seule : runner et premier parcours (US1, US2), puis les autres parcours (US3), le rapport d'échec (US4), la doc (US5). |
| V. Simplicité | ✅ | Aucun mécanisme produit : pas de route serveur, pas de variable d'app, pas d'interrupteur de test dans l'app (R3, R4, R9). L'outillage reste hors de l'app livrée ; seuls des `testID` y entrent. |
| Hébergement Docker | ✅ | Rien ne change pour l'image ni pour la prod. Les variables du runner ne sont pas des variables de déploiement (R15). |
| Workflow | ✅ | La spec ne nomme Maestro que parce que la demande le nomme ; les choix techniques sont ici. |

**Re-check après Phase 1** : ✅. Point d'attention : la règle d'`AGENTS.md` « nouvelle variable → README, .env.example, compose » ne s'applique pas aux variables du runner (R15). La relecture de la feature doit trouver cette décision écrite dans `AGENTS.md`, pas la découvrir.

## Project Structure

### Documentation (this feature)

```text
specs/007-mobile-e2e-maestro/
├── spec.md
├── plan.md                    # ce fichier
├── research.md                # R1–R16
├── data-model.md              # parcours, sous-parcours, exécution, exclusions
├── quickstart.md              # valider la suite elle-même
├── contracts/
│   ├── e2e-command.md         # commande, options, variables, codes de sortie, sorties
│   └── test-ids.md            # convention et liste des testID par écran
├── checklists/requirements.md
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
mobile/
├── .maestro/
│   ├── README.md                    # NOUVEAU — prérequis, commande, écrire un parcours
│   ├── exclusions.md                # NOUVEAU — ce qui reste manuel, par story (R16)
│   ├── config.yaml                  # NOUVEAU — flows: flows/*.yaml
│   ├── flows/                       # NOUVEAU — un parcours par story, tags 005-usN / 006-usN
│   │   ├── 005-us1-auth.yaml
│   │   ├── 005-us2-lists.yaml
│   │   ├── 005-us3-items.yaml
│   │   ├── 005-us4-share.yaml
│   │   ├── 005-us5-offline.yaml     # tag android-only (R9)
│   │   ├── 006-us1-delete-account.yaml
│   │   ├── 006-us2-legal.yaml
│   │   ├── 006-us3-export.yaml
│   │   └── 006-us4-about.yaml
│   ├── subflows/                    # NOUVEAU
│   │   ├── launch-clean.yaml        # clearState + clearKeychain (R5)
│   │   ├── login.yaml               # env EMAIL, PASSWORD
│   │   ├── register.yaml            # compte e2e-<unique>@example.test (R6)
│   │   └── create-list.yaml         # env TITLE
│   └── scripts/
│       ├── unique.js                # NOUVEAU — output.unique
│       └── strings.generated.js     # GÉNÉRÉ par le runner, ignoré par git (R7)
├── scripts/
│   ├── e2e.mjs                      # NOUVEAU — runner (R2, R3, R8, R10, R12, R13)
│   └── e2e/                         # NOUVEAU — fonctions pures du runner
│       ├── junit.mjs                # rapport JUnit → résumé
│       ├── strings.mjs              # locales → strings.generated.js, échappement regex
│       └── locale.mjs               # langue de l'appareil → fr | en
├── __tests__/e2e/                   # NOUVEAU
│   ├── test-ids.test.ts             # chaque id: des parcours existe dans l'app (R14)
│   ├── coverage.test.ts             # chaque story 005/006 a un parcours ou une exclusion
│   └── runner.test.ts               # junit, strings, locale
├── app/**/*.tsx                     # MODIFIÉ — testID sur les éléments d'action
├── src/ui/*.tsx                     # MODIFIÉ si besoin — transmettre testID (Field, Select, ConfirmDialog, BackLink…)
└── package.json                     # MODIFIÉ — script "e2e"

.gitignore                           # MODIFIÉ — mobile/.maestro/scripts/strings.generated.js
AGENTS.md                            # MODIFIÉ — commande e2e, règle « une story = un parcours », variables du runner
mobile/AGENTS.md                     # MODIFIÉ — renvoi vers .maestro/README.md
specs/005-mobile-list-app/quickstart.md      # MODIFIÉ — renvoi vers la suite et ses exclusions
specs/006-mobile-legal-account/quickstart.md # MODIFIÉ — idem
```

Les parcours jetables de `tmp/maestro/` (non versionnés) ne sont pas repris tels quels. On en garde l'enchaînement des écrans, puis le dossier peut être supprimé à la main (FR-015).

**Structure Decision** : tout vit dans le package `mobile/`, qui a déjà ses scripts et ses tests jest. Le runner appelle le script de démo du site (`scripts/create-demo-data.mjs`) par `node --import tsx`, depuis la racine, comme `npm run demo:data`.

## Ordre de livraison

1. **US1 et US2 (P1)** :
   - runner avec prérequis, base, textes, résumé ;
   - sous-parcours `launch-clean` et `login` ;
   - `testID` des écrans de connexion ;
   - parcours `005-us1-auth`, qui suffit à valider la mécanique sur iOS et Android.
2. **US3 (P2)** : les huit autres parcours, chacun avec ses `testID`, et `exclusions.md` ; test de couverture.
3. **US4 (P2)** : lecture du rapport JUnit (étape fautive, chemin des captures) ; vérification par régression volontaire (SC-005).
4. **US5 (P3)** : `AGENTS.md`, `mobile/AGENTS.md`, `README` de la suite, renvois dans les `quickstart.md` ; test des identifiants.

## Complexity Tracking

Aucune violation à justifier.
