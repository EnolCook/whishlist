# Data Model: suite de tests de bout en bout

Pas de donnée applicative nouvelle : ni schéma, ni route, ni stockage dans l'app. Les « entités » ci-dessous sont des fichiers de la suite et ce que le runner produit.

## Parcours (`mobile/.maestro/flows/<feature>-us<N>-<slug>.yaml`)

| Champ | Où | Règle |
|-------|----|-------|
| `appId` | en-tête | `app.ohyoushouldnt.mobile` (build Release ou Debug de la variante `production`) |
| `name` | en-tête | `<feature> US<N> — <titre de la story>`, repris dans le résumé |
| `tags` | en-tête | exactement un tag de story (`005-us1`…`006-us4`) ; `android-only` si le parcours ne peut pas tourner sur iOS (R9) |
| première étape | corps | `runFlow: ../subflows/launch-clean.yaml` (FR-004) |
| connexion | corps | `runFlow: ../subflows/login.yaml` avec `env`, jamais d'étapes de connexion recopiées (FR-005) |
| textes | corps | `runScript: ../scripts/strings.generated.js`, puis `${output.t.<ns>.<clé>}` ; aucun texte d'interface en dur (R7) |
| sélecteurs d'action | corps | `id:` selon [contracts/test-ids.md](contracts/test-ids.md) |
| attentes | corps | `extendedWaitUntil` ou attente implicite, jamais d'attente à durée fixe |

**Invariants** :
- Le parcours réussit seul, sur une app vide, et deux fois de suite (FR-003, FR-007).
- Tout ce qu'il supprime, il l'a créé dans la même exécution (FR-006).
- Il ne lit aucun état laissé par un autre parcours.

## Sous-parcours (`mobile/.maestro/subflows/`)

| Fichier | Entrées (`env`) | Effet |
|---------|-----------------|-------|
| `launch-clean.yaml` | — | `launchApp` avec `clearState: true` et `clearKeychain: true` ; attend l'écran de connexion (`login.screen`) |
| `login.yaml` | `EMAIL` (compte de démo) | saisit l'adresse et `${MAESTRO_DEMO_PASSWORD}`, valide ; attend « Mes listes », puis vérifie `lists.card-demo-list` : preuve que l'app parle à la base de la suite |
| `register.yaml` | — | se connecte d'abord avec Alex puis se déconnecte (preuve du serveur local), lance `unique.js`, inscrit `E2E <unique>` / `e2e-<unique>@example.test` avec `${MAESTRO_DEMO_PASSWORD}` ; rend l'adresse dans `output.email` ; attend `lists.screen` |
| `logout.yaml` | — | depuis « Mes listes » : Mon compte → Se déconnecter ; attend `login.screen` |
| `create-list.yaml` | `TITLE` | depuis « Mes listes », crée la liste (catégorie « Livres », pour « Alex ») ; attend `list.screen` |
| `add-item.yaml` | `NAME` | sur l'onglet Idées, ajoute l'idée ; attend `list.screen` |
| `open-category.yaml` | `CATEGORY`, `ITEM` | déplie la catégorie si l'idée n'est pas visible, puis fait défiler jusqu'à elle |
| `close-share-sheet.yaml` | — | vérifie que la feuille de partage du système est ouverte, puis la referme (iOS : bouton `Close` ; Android : retour) |

## Exécution (produite par le runner)

```text
tmp/e2e/
├── wishlist.json                         # base régénérée (R3)
└── results/<AAAAMMJJ-HHMMSS>-<ios|android>/
    ├── report.xml                        # JUnit de Maestro
    ├── summary.txt                       # résumé affiché, une ligne par parcours
    └── <dossiers Maestro par parcours>   # journaux, capture à l'échec (R12)
```

Statut d'un parcours dans le résumé :

| Statut | Quand |
|--------|-------|
| `réussi` | Maestro le rapporte réussi |
| `échoué` | Maestro le rapporte en échec ; la ligne porte l'étape fautive (message JUnit) |
| `non joué` | exclu par tag sur cette plateforme ; la ligne porte la raison (R9) |

Le code de sortie vaut 0 si aucun parcours n'a échoué, 1 si au moins un parcours a échoué, 2 si un prérequis manque (rien n'a été joué). Voir [contracts/e2e-command.md](contracts/e2e-command.md).

## Liste d'exclusions (`mobile/.maestro/exclusions.md`)

Un tableau, une ligne par vérification qui reste manuelle :

| Colonne | Contenu |
|---------|---------|
| Story | `005-us4`, … ; une story entièrement manuelle (`005-us6`) a une ligne « story entière » |
| Vérification | ce qui n'est pas automatisé |
| Raison | pourquoi (sort de l'app, service externe, limite de plateforme) |
| Où la faire | lien vers la section du `quickstart.md` |

Le test de couverture (R14) lit la colonne « Story » : une story sans parcours doit y figurer avec « story entière ».

## Textes générés (`mobile/.maestro/scripts/strings.generated.js`)

- Le fichier est écrit par le runner à chaque exécution, pour la langue choisie (R8), et n'est pas versionné.
- Il contient `output.t = { <namespace>: { … } }` pour tous les namespaces de `src/i18n/config.ts`.
- Chaque valeur est une regex qui reconnaît le texte exact : les caractères spéciaux sont échappés.
- Les clés à variable (`{{…}}`) sont omises : un parcours qui en a besoin passe par un `testID`.
