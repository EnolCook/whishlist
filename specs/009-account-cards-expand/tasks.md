---

description: "Task list for feature 009 — cartes repliables sur l'écran de compte de l'app"
---

# Tasks: Cartes repliables sur l'écran de compte de l'app

**Input**: Design documents from `specs/009-account-cards-expand/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/collapsible-card.md](contracts/collapsible-card.md), [quickstart.md](quickstart.md)

**Tests**: inclus. AGENTS.md demande un test pour chaque règle et cas limite, et un parcours Maestro par user story de l'app mobile.

**Organization**: tâches groupées par user story. Tout se passe dans `mobile/` et `locales/` ; le site n'est pas touché.

## Un commit par user story (règle du projet)

Chaque phase de user story se termine par une tâche **« Commit de la story »**, la dernière de la phase. Règles :

- Les phases Setup et Foundational n'ont pas de commit propre : elles entrent dans le commit de la première story.
- Chaque commit est vert (lint, types, tests). Un test existant à adapter va dans le commit de la story qui rend l'adaptation nécessaire.
- Un fichier modifié par deux stories est commité en deux temps (seulement les changements de la story en cours).
- La phase Polish a son propre commit (`chore:` ou `feat:` selon le contenu). Les corrections de la revue lancée par le hook `after_implement` forment un commit à part, `fix: corrections de la revue`, avec `review.md`.
- Message en anglais, préfixé `feat:`, `fix:` ou `chore:`, terminé par `(USn)`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallélisable (fichiers différents, pas de dépendance sur une tâche non finie)
- **[Story]**: story concernée (US1, US2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: textes du composant

- [X] T001 [P] Ajouter la section `"collapsible": { "expand": "Déplier", "collapse": "Replier" }` à `locales/fr/mobile.json` et `"collapsible": { "expand": "Expand", "collapse": "Collapse" }` à `locales/en/mobile.json` (mêmes clés dans les deux fichiers, voir [contracts/collapsible-card.md § Textes](contracts/collapsible-card.md#textes))

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: le composant `CollapsibleCard`, utilisé par les deux stories

**⚠️ CRITICAL**: aucune story ne commence avant la fin de cette phase

- [X] T002 Écrire les tests de `CollapsibleCard` (d'abord en échec) dans `mobile/__tests__/ui/components.test.tsx`, bloc `describe("CollapsibleCard", …)`, avec `testID="card"` :
  - repliée par défaut : titre et description visibles ; `card-toggle` a `accessibilityState.expanded === false`, `accessibilityRole="button"`, libellé = titre, indice « Déplier » ; `card-content` porte `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"` et `pointerEvents="none"` ;
  - `defaultExpanded` : dépliée au montage, indice « Replier » ;
  - un appui sur `card-toggle` déplie, un second replie (état `expanded` et indices suivis) ;
  - un appui sur un bouton du contenu déplié ne replie pas ;
  - la saisie d'un `Input` du contenu survit à un repli puis un dépliage (le contenu reste monté) ;
  - au repli, `Keyboard.dismiss` est appelé (`jest.spyOn(Keyboard, "dismiss")`) ;
  - réduire les animations : avec `AccessibilityInfo.isReduceMotionEnabled` mocké à `true`, `Animated.timing` n'est pas appelé lors d'une bascule ; sans la préférence, il l'est avec `duration: 200` ;
  - la carte garde la boîte de `Card` : réutiliser `expectShadow("card")`.
- [X] T003 Implémenter `CollapsibleCard` dans `mobile/src/ui/Card.tsx`, à côté de `Card`, selon [contracts/collapsible-card.md](contracts/collapsible-card.md) et [research.md R1–R5](research.md) :
  - props `title: string`, `description?: string`, `children: ReactNode`, `defaultExpanded?: boolean` (défaut `false`), `testID?: string` ; pas de mode contrôlé ;
  - boîte : `Shadow` avec la même `paddingVertical` que `Card` mais sans `gap` (l'espace entre en-tête et contenu est un `paddingTop: tokens.space[4]` dans la vue mesurée, pour qu'une carte repliée n'ait pas d'espace vide en bas) ;
  - en-tête : `Pressable` (`testID` `${testID}-toggle`, `accessibilityRole="button"`, `accessibilityState={{ expanded }}`, `accessibilityLabel={title}`, `accessibilityHint` = `t("mobile:collapsible.expand")` ou `t("mobile:collapsible.collapse")`) qui contient `CardHeader` avec `CardTitle`, `CardDescription` si `description`, et en `action` un `Animated.View` tourné de `0deg` à `180deg` autour d'un `ChevronDownIcon` de `lucide-react-native` (même taille et couleur que dans `mobile/src/ui/Select.tsx`) ;
  - contenu : `Animated.View` (`testID` `${testID}-content`, `overflow: "hidden"`, `height` = `progress.interpolate([0, 1] → [0, contentHeight])`, `opacity` = `progress`) contenant une vue `position: "absolute"`, `top: 0`, `left: 0`, `right: 0`, dont `onLayout` met à jour `contentHeight` ; dedans, `CardContent` avec `children`. Replié : `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`, `pointerEvents="none"` ;
  - état : `expanded` (`useState(defaultExpanded)`), `progress` (`Animated.Value` initialisée à `defaultExpanded ? 1 : 0`), `contentHeight` (nombre, `0` au départ) ; à la bascule : `Keyboard.dismiss()` si on replie, puis `Animated.timing(progress, { toValue, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: false })`, ou `progress.setValue(toValue)` si réduire les animations est actif ; un nouvel appui pendant l'animation relance `timing` vers la dernière valeur demandée ;
  - réduire les animations : `AccessibilityInfo.isReduceMotionEnabled()` au montage et abonnement `AccessibilityInfo.addEventListener("reduceMotionChanged", …)`, retiré au démontage ;
  - commentaire d'en-tête dans le style du fichier, qui renvoie à `components/ui/accordion.tsx`.
- [X] T004 [P] Ajouter un exemple de `CollapsibleCard` (un replié, un `defaultExpanded`) dans `mobile/app/dev/catalog.tsx`, près de l'exemple de `Card`
- [X] T005 Lancer `npm --prefix mobile test -- __tests__/ui/components.test.tsx` : les tests de T002 passent

**Checkpoint**: le composant existe, testé ; les stories peuvent commencer

---

## Phase 3: User Story 1 - Déplier la carte Profil pour changer son nom (Priority: P1) 🎯 MVP

**Goal**: la carte Profil de « Mon compte » est repliée à l'ouverture et se déplie par un appui animé.

**Independent Test**: [quickstart.md § US1](quickstart.md#us1--carte-profil) ; parcours Maestro `009-us1`.

### Tests for User Story 1

- [X] T006 [US1] Dans `mobile/__tests__/screens/account.test.tsx`, ajouter : à l'ouverture, `account.profile-toggle` est replié et le champ `account.name` est dans un contenu caché (`account.profile-content` avec `accessibilityElementsHidden`) ; après appui sur `account.profile-toggle`, changement du nom et appui sur `account.save-name`, la carte est toujours dépliée et « nom enregistré » (`auth:account.nameSaved`) est affiché. Adapter les tests existants qui touchent au nom s'ils en dépendent
- [X] T007 [P] [US1] Ajouter `"009": "specs/009-account-cards-expand/spec.md"` à la table `specs` de `mobile/__tests__/e2e/coverage.test.ts` (et mettre à jour le titre du test qui cite « features 005 and 006 »). Le test lit toutes les stories de la spec : pour que le commit de US1 reste vert, ajouter à `mobile/.maestro/exclusions.md` la ligne provisoire `| 009-us2 | Story entière, livrée avec US2 | Parcours écrit avec la story 2 | [009 quickstart, US2](../../specs/009-account-cards-expand/quickstart.md#us2--carte-mot-de-passe) |`, retirée en T016
- [X] T008 [P] [US1] Écrire `mobile/.maestro/flows/009-us1-profile-card.yaml` (tag `009-us1`, sur le modèle de `006-us4-about.yaml`) : `launch-clean`, `login` avec `alex@example.test`, `tapOn: open-account` ; `assertNotVisible: id: account.name` ; `tapOn: id: account.profile-toggle` ; `assertVisible: id: account.name` ; saisir un nouveau nom dans `account.name`, `tapOn: account.save-name`, attendre le texte `${output.t.auth.account.nameSaved}` (après `runScript: ../scripts/strings.generated.js`) ; `tapOn: account.profile-toggle` ; `assertNotVisible: id: account.name`

### Implementation for User Story 1

- [X] T009 [US1] Dans `mobile/app/(app)/account.tsx`, remplacer la `Card` Profil par `<CollapsibleCard testID="account.profile" title={t("auth:account.profile")} description={t("auth:account.profileHint")}>` dont les enfants sont le contenu actuel du `CardContent` (champs, alertes, bouton `account.save-name`) ; retirer les imports devenus inutiles ; mettre à jour le commentaire d'en-tête de l'écran (cartes Profil et Mot de passe repliables, 009)
- [X] T010 [US1] Lancer `npm --prefix mobile test` (dont `test-ids.test.ts`, qui vérifie que chaque `id:` du parcours existe dans l'app) et jouer `npm --prefix mobile run e2e -- .maestro/flows/009-us1-profile-card.yaml` ; si le simulateur n'est pas disponible, le dire et suivre [quickstart.md § US1](quickstart.md#us1--carte-profil) à la main — Fait : `npm --prefix mobile test` vert. Parcours Maestro non joué : la base `tmp/e2e/wishlist.db` date d'une version antérieure de la migration `0000_init` (008) et la commande e2e échoue à la recréer (« table `api_sessions` already exists ») ; à rejouer après avoir supprimé ce fichier et relancé le serveur de la suite.
- [X] T011 [US1] Commit de la story : `npm run lint`, `npm run typecheck`, `npm test`, `npm --prefix mobile run lint`, `npm --prefix mobile run typecheck` et `npm --prefix mobile test` verts, puis proposer le commit `feat: collapsible profile card on the mobile account screen (US1)` des fichiers de T001–T010 (Setup et Foundational compris, et les fichiers de spec de `specs/009-account-cards-expand/`) ; attendre l'accord avant de le créer

**Checkpoint**: la carte Profil se replie et se déplie ; le reste de l'écran est inchangé

---

## Phase 4: User Story 2 - Déplier la carte Mot de passe (Priority: P2)

**Goal**: la carte « Modifier le mot de passe » se comporte comme la carte Profil.

**Independent Test**: [quickstart.md § US2](quickstart.md#us2--carte-mot-de-passe) ; parcours Maestro `009-us2`.

### Tests for User Story 2

- [X] T012 [US2] Dans `mobile/__tests__/screens/account.test.tsx`, ajouter : à l'ouverture, `account.password-toggle` est replié ; après appui, `account.password-current` est visible ; avec un faux `fetch` qui répond par une erreur de mot de passe actuel puis par un succès, le message d'erreur puis celui de succès (`auth:changePassword.success`) s'affichent dans la carte toujours dépliée ; les cartes Profil et Mot de passe peuvent être dépliées en même temps
- [X] T013 [P] [US2] Écrire `mobile/.maestro/flows/009-us2-password-card.yaml` (tag `009-us2`) : `launch-clean`, `register` (compte neuf, pour ne pas changer le mot de passe d'un compte de démo), `tapOn: open-account` ; `assertNotVisible: id: account.password-current` ; `tapOn: id: account.password-toggle` ; remplir `account.password-current`, `account.password-next`, `account.password-confirm`, `tapOn: account.password-submit` ; attendre `${output.t.auth.changePassword.success}` ; vérifier que `account.password-current` est toujours visible — Fait autrement : sur le simulateur iOS, Maestro ne parvient pas à remplir les champs sécurisés de ce formulaire (déjà vrai avec une carte simple, avant la 009). Le parcours se connecte avec `alex@example.test` et vérifie replié → déplié (trois champs) → ouvert avec Profil → replié ; l'envoi est une ligne de `exclusions.md`, le message dans la carte ouverte est couvert par T012.

### Implementation for User Story 2

- [X] T014 [US2] Dans `mobile/src/features/account/PasswordForm.tsx`, ajouter une prop optionnelle `testID?: string` ; quand elle est fournie, poser `${testID}-current`, `${testID}-next`, `${testID}-confirm` sur les trois `Input` et `${testID}-submit` sur le bouton. `mobile/app/change-password.tsx` ne la passe pas et reste inchangé
- [X] T015 [US2] Dans `mobile/app/(app)/account.tsx`, remplacer la `Card` Mot de passe par `<CollapsibleCard testID="account.password" title={t("auth:changePassword.title")}>` (sans description, comme aujourd'hui) contenant `<PasswordForm testID="account.password" />` ; retirer les imports devenus inutiles (`Card`, `CardHeader`, `CardTitle`, `CardContent` restent utilisés par la carte des données)
- [X] T016 [US2] Retirer de `mobile/.maestro/exclusions.md` la ligne provisoire `009-us2` ajoutée en T007, puis lancer `npm --prefix mobile test` et jouer `npm --prefix mobile run e2e -- .maestro/flows/009-us2-password-card.yaml`, puis les parcours qui passent par l'écran de compte (`005-us5-offline.yaml`, `006-us2-legal.yaml`, `006-us4-about.yaml`) ; si le simulateur n'est pas disponible, le dire et suivre [quickstart.md § US2](quickstart.md#us2--carte-mot-de-passe) à la main — Fait : `009-us1`, `009-us2`, `006-us2`, `006-us4` verts sur iOS ; `005-us5` non joué sur iOS (comme avant).
- [X] T017 [US2] Commit de la story : `npm run lint`, `npm run typecheck`, `npm test`, `npm --prefix mobile run lint`, `npm --prefix mobile run typecheck` et `npm --prefix mobile test` verts, puis proposer le commit `feat: collapsible password card on the mobile account screen (US2)` des fichiers de T012–T016 ; attendre l'accord avant de le créer

**Checkpoint**: les deux cartes sont repliables, indépendantes ; l'écran de changement imposé est inchangé

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: vérifications à la main que les tests automatiques ne couvrent pas

- [X] T018 Ajouter à `mobile/.maestro/exclusions.md` les lignes des vérifications non automatisées, chacune avec sa raison et un lien vers le quickstart : `009-us1` VoiceOver / TalkBack (étape 7), réduire les animations (étape 8), mode avion (étape 9) ; format des lignes existantes (vérifié par `coverage.test.ts`)
- [ ] T019 Suivre [quickstart.md](quickstart.md) en entier sur simulateur iOS et émulateur Android (fluidité, absence de saut, lecteurs d'écran, réduire les animations, anglais), et la section Non-régression (page `/compte` du site inchangée)
- [X] T020 Commit Polish : checks verts comme en T017, puis proposer le commit `chore: manual checks of the collapsible account cards` ; attendre l'accord avant de le créer

---

## Phase 6: User Story 3 - Déplier la carte Données et informations (Priority: P3)

**Goal**: la carte « Vos données et informations » se comporte comme les deux autres (ajout demandé le 2026-11-01, après US1 et US2).

**Independent Test**: [quickstart.md § US3](quickstart.md#us3--carte-données-et-informations) ; parcours Maestro `009-us3`.

### Tests for User Story 3

- [X] T021 [US3] Dans `mobile/__tests__/ui/components.test.tsx`, vérifier que `contentStyle` est appliqué au `CardContent` de `CollapsibleCard`
- [X] T022 [US3] Dans `mobile/__tests__/screens/account.test.tsx`, ajouter : à l'ouverture, `account.data-toggle` est replié et « Mentions légales » introuvable ; adapter les tests existants qui touchent aux liens de la carte (« the links open… », test hors ligne) pour déplier d'abord la carte, et vérifier qu'elle se déplie hors ligne (scénario 4)
- [X] T023 [P] [US3] Écrire `mobile/.maestro/flows/009-us3-data-card.yaml` (tag `009-us3`) : connexion `alex@example.test`, `open-account`, `assertNotVisible: account.legal`, `tapOn: account.data-toggle`, `account.legal` visible, l'ouvrir, revenir (`back-link.back`), `account.legal` toujours visible ; puis replier et `assertNotVisible: account.legal`
- [X] T024 [P] [US3] Adapter `mobile/.maestro/flows/006-us2-legal.yaml`, `006-us3-export.yaml` et `006-us4-about.yaml` : `scrollUntilVisible` puis `tapOn: account.data-toggle` avant le premier lien de la carte — Fait ; `006-us3` redéplie aussi la carte si l'appui qui ferme la feuille de partage iOS l'a repliée (cet appui touche l'en-tête juste dessous).

### Implementation for User Story 3

- [X] T025 [US3] Ajouter la prop optionnelle `contentStyle?: StyleProp<ViewStyle>` à `CollapsibleCard` dans `mobile/src/ui/Card.tsx`, transmise à `CardContent`
- [X] T026 [US3] Dans `mobile/app/(app)/account.tsx`, remplacer la `Card` « Vos données et informations » par `<CollapsibleCard testID="account.data" title={t("auth:account.dataTitle")} description={t("auth:account.dataHint")} contentStyle={{ alignItems: "flex-start" }}>` avec le même contenu ; retirer les imports devenus inutiles
- [X] T027 [US3] Lancer `npm --prefix mobile test`, puis jouer `009-us3-data-card.yaml`, `006-us2-legal.yaml`, `006-us3-export.yaml`, `006-us4-about.yaml` sur iOS — Fait : `009-us1`, `009-us2`, `009-us3`, `006-us2`, `006-us3`, `006-us4`, `005-us4` verts sur iOS.
- [X] T028 [US3] Commit de la story : checks verts comme en T017, puis proposer le commit `feat: collapsible data card on the mobile account screen (US3)` ; attendre l'accord avant de le créer

**Checkpoint**: les trois cartes sont repliables

---

## Phase 7: User Story 4 - Déplier une catégorie d'idées avec la même animation (Priority: P4)

**Goal**: les catégories de l'onglet Idées (`IdeasAccordion`) prennent l'animation des cartes du compte (ajout demandé le 2026-11-01).

**Independent Test**: [quickstart.md § US4](quickstart.md#us4--catégories-de-longlet-idées) ; parcours Maestro `009-us4`.

- [X] T029 [US4] Extraire la mécanique de `CollapsibleCard` dans `mobile/src/ui/Accordion.tsx` (`useAccordion`, `AccordionChevron`, `AccordionContent`, pendant de `components/ui/accordion.tsx`) ; `CollapsibleCard` dans `mobile/src/ui/Card.tsx` les utilise ; la vue mesurée devient `<testID>-content-measure` (test de `components.test.tsx` adapté)
- [X] T030 [US4] Dans `mobile/src/features/items/IdeasAccordion.tsx`, une catégorie devient `CategorySection` (son propre `useAccordion`), avec `AccordionChevron` (noir) et `AccordionContent` ; en-tête, flèches d'ordre et `list.category-<id>` inchangés
- [X] T031 [P] [US4] Tests dans `mobile/__tests__/features/ideas-accordion.test.tsx` : repliée au départ (idée cachée aux lecteurs d'écran), dépliée avec `Animated.timing` 200 ms, repliée de nouveau, état propre à chaque catégorie, texte d'une catégorie vide
- [X] T032 [P] [US4] Parcours `mobile/.maestro/flows/009-us4-ideas-categories.yaml` (tag `009-us4`) : liste de démo, « Lampe de lecture » cachée, « Maison » dépliée puis repliée
- [X] T033 [US4] Lancer `npm --prefix mobile test`, puis `009-us4`, `005-us3`, `005-us4` sur iOS — Fait : 153 tests verts ; `009-us4`, `005-us3`, `005-us4`, `009-us1`, `009-us3` verts sur iOS.
- [X] T034 [US4] Commit de la story : checks verts comme en T017, puis proposer le commit `feat: animated ideas categories in the mobile list (US4)` ; attendre l'accord avant de le créer

- [X] T035 [US4] Revue partielle : contenu des catégories monté seulement déplié (`shown` de `useAccordion`, `mounted` de `AccordionContent`) ; licences sur `CollapsibleContentSection` ; tests de `ideas-accordion.test.tsx` (flèches repliée, état après réordonnancement, hauteur, réduire les animations) et `licenses.test.tsx` ; sous-parcours `open-account-data.yaml` ; `009-us4` par identifiants ; `exclusions.md` et quickstart

**Checkpoint**: toutes les sections repliables de l'app partagent la même animation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** : aucune dépendance.
- **Foundational (Phase 2)** : après T001 (le composant lit `mobile:collapsible.*`). Bloque les deux stories.
- **US1 (Phase 3)** puis **US2 (Phase 4)** : après la Phase 2. US2 ne dépend pas de US1 fonctionnellement, mais les deux modifient `mobile/app/(app)/account.tsx` et `mobile/__tests__/screens/account.test.tsx` : les faire dans l'ordre évite de commiter un fichier en deux temps.
- **Polish (Phase 5)** : après les deux stories.

### Within Each Story

- Tests (T006/T012) écrits avant l'implémentation, en échec au départ.
- Le parcours Maestro (T008/T013) peut s'écrire en parallèle, il ne se joue qu'une fois l'écran modifié.
- La tâche « Commit de la story » est la dernière de la phase.

### Parallel Opportunities

- T004 en parallèle de T002/T003 une fois l'API du composant fixée par le contrat.
- Dans US1 : T007 et T008 en parallèle de T006.
- Dans US2 : T013 en parallèle de T012 et T014.

---

## Parallel Example: User Story 1

```bash
Task: "Ajouter 009 à la table specs de mobile/__tests__/e2e/coverage.test.ts"
Task: "Écrire mobile/.maestro/flows/009-us1-profile-card.yaml"
Task: "Tests d'écran de la carte Profil dans mobile/__tests__/screens/account.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2 : textes et composant testé.
2. Phase 3 : carte Profil repliable.
3. **STOP and VALIDATE** : parcours `009-us1` et quickstart US1.

### Incremental Delivery

1. Setup + Foundational + US1 → un commit, livrable seul.
2. US2 → un commit.
3. Polish → un commit ; puis la revue `wishlist-feature-review` (hook `after_implement`).

---

## Notes

- `coverage.test.ts` exige un parcours par story de chaque spec de sa table : d'où la ligne provisoire `009-us2` dans `exclusions.md` entre T007 et T016, pour que le commit de US1 reste vert.
- Aucune tâche ne touche le site, l'API, `src/` ni `locales/*/auth.json`.
