# Revue de code

## Fichiers relus

```text
2e438ad6a9e75c3778f582dc029783b2e79423cf  locales/en/mobile.json
c62d0690ca54751059d3c58d88a7c20726d0090c  locales/fr/mobile.json
ac9e6b538bf329c995977da0984e8a4c0572aa01  mobile/.maestro/flows/006-us2-legal.yaml
1cf4585a4b7ee90d91e3d593b77b08fe437e5a3b  mobile/.maestro/flows/006-us3-export.yaml
fd8f9380cdb74297ba213cd20920271806e47846  mobile/.maestro/flows/006-us4-about.yaml
d65ea8dc9ffce6b7849a953f49fa58cbf30ec6fe  mobile/.maestro/flows/009-us1-profile-card.yaml
764e87fc216a7b25077da0b5644825dd1b6b1658  mobile/.maestro/flows/009-us2-password-card.yaml
2adfc8aff82ff51cc8c3b691ca6f436239e907e6  mobile/.maestro/flows/009-us3-data-card.yaml
4b2d5cbcade349c96c6496b756584d8cfa004a6c  mobile/.maestro/flows/009-us4-ideas-categories.yaml
66b2601f474e224c930fb1412ff860365748828a  mobile/.maestro/subflows/open-account-data.yaml
d54842706a6b1afd29ca49e0335f7bcd78cbd2b5  mobile/__tests__/e2e/coverage.test.ts
e0b5382ea47409c4f4e9923210ff589faa57c426  mobile/__tests__/e2e/test-ids.test.ts
f609d3a84f19009933126e18050aaeaf5b586ac1  mobile/__tests__/features/ideas-accordion.test.tsx
b6b72897e6b6bcdcdb1e380de795fdfb7ac386c3  mobile/__tests__/screens/account.test.tsx
0b583af9ce28f84a123d2ba2c841e7531c12cf41  mobile/__tests__/screens/licenses.test.tsx
81e44bee0a6e61e540f8cec8ab6b1c220ea5e09f  mobile/__tests__/ui/components.test.tsx
da357b6d8f36ca9f9a3de7ba844dfda35d9a0597  mobile/app/(app)/account.tsx
a79c93068d88be351928fbef9d562439112b686d  mobile/app/dev/catalog.tsx
45226889ff0029f933d5975c6bdd1dd7d82af7d2  mobile/app/legal/licenses.tsx
f1bd34c9b2e02d23eccc34be13510f79e55f2853  mobile/src/features/account/PasswordForm.tsx
b3b0f0fb3f962bcc9ee85771c27c3f2e97864928  mobile/src/features/items/IdeasAccordion.tsx
c1570debebccca764fb713c6211f3220dbc11bc0  mobile/src/theme/motion.ts
de0e1230b8401345d06e4b3d211b3c36bba7943e  mobile/src/ui/Accordion.tsx
35181a542e485c75e1bfe921dd5491fa0a7f2645  mobile/src/ui/Card.tsx
de06b3d2bd0227bab5b1f9fcee4feed38e99f27e  mobile/src/ui/ContentSection.tsx
51cce2f6f62234a9cdd756f928b987e44a98ef0f  mobile/src/ui/LiveGiftMark.tsx
```

## Règles métier et tests

- [x] mobile/src/ui/Card.tsx:106 — Le chevron n'a pas d'identifiant de test, alors que FR-011 en demande un stable pour l'en-tête et pour l'indicateur (le contrat ne liste que `-toggle` et `-content`). Correction : poser `${testID}-chevron` sur l'`Animated.View` du chevron, l'ajouter au contrat et aux suffixes de `mobile/__tests__/e2e/test-ids.test.ts`.
- [x] mobile/__tests__/ui/components.test.tsx:131 — Aucun test ne couvre les appuis rapides répétés (data-model : « relancent l'animation vers la dernière valeur demandée »), et le repli animé (`toValue: 0`) n'est jamais vérifié. Correction : appuyer deux fois de suite sur `card-toggle`, vérifier que le dernier `Animated.timing` a `toValue: 0`, puis `expectCollapsed(true)`.
- [x] mobile/__tests__/ui/components.test.tsx:131 — FR-008 (le chevron pivote selon l'état) n'a aucun test. Correction : vérifier la rotation du chevron (`0deg` replié, `180deg` déplié, avec « réduire les animations » pour ne pas attendre l'animation), via le testID du point précédent.
- [x] mobile/__tests__/ui/components.test.tsx:131 — FR-004 demande de suivre la préférence en direct (abonnement `reduceMotionChanged`), mais seule la lecture au montage est testée. Correction : capturer le listener d'`AccessibilityInfo.addEventListener`, l'appeler avec `true` après le rendu, puis vérifier qu'une bascule n'appelle pas `Animated.timing`.
- [x] mobile/__tests__/ui/components.test.tsx:131 — R2 et data-model (`contentHeight` suit le contenu, par exemple une alerte qui apparaît) ne sont pas testés. Correction : déclencher `layout` sur la vue mesurée, carte dépliée, et vérifier la hauteur de `card-content`.
- [x] mobile/__tests__/screens/account.test.tsx:127 — Le cas limite « Hors ligne : les cartes se déplient ; ce qui est désactivé le reste » n'a pas de test d'écran. Correction : dans le test hors ligne, déplier `account.profile-toggle` et vérifier que la carte est dépliée et `account.save-name` désactivé.
- [x] mobile/__tests__/ui/components.test.tsx:180 — « Toucher un champ ne replie pas la carte » n'est testé que sur un bouton. Correction : déclencher `focus` sur l'`Input` « Nom », puis `expectCollapsed(false)`.
- [x] specs/009-account-cards-expand/quickstart.md:3 — Le quickstart dit que les étapes 1 à 4 de chaque story sont rejouées par la suite e2e, ce qui est faux pour US2 étape 3 (envoi, dans exclusions.md) et US1 étape 4 (toucher un champ). Correction : nommer les étapes réellement rejouées et renvoyer à exclusions.md pour les autres.
- [x] specs/009-account-cards-expand/research.md:46 — R7 dit encore que le parcours US2 crée un compte avec `register`, alors qu'il se connecte avec `alex@example.test`. Correction : mettre R7 à jour.
- [x] mobile/src/features/items/IdeasAccordion.tsx:144 — Revue partielle (US3, US4). Les idées de toutes les catégories sont maintenant montées même repliées : une longue liste coûte plus cher au montage et à chaque mise à jour, sans que la spec le demande (seuls les formulaires du compte doivent garder leur saisie). Correction : option de `AccordionContent` pour ne monter le contenu qu'une fois déplié (ou le démonter après le repli), utilisée par `CategorySection`.
- [x] mobile/src/features/items/IdeasAccordion.tsx:144 — Les `item-card.edit` / `item-card.archive` des catégories repliées existent à hauteur 0 : `005-us3` (lignes 62, 84, 150) et `005-us5` (ligne 47, `index: 0`) peuvent viser une carte cachée ; `005-us5` n'a pas été rejoué. Correction : réglé par le point précédent ; rejouer `005-us5` sur Android.
- [x] mobile/__tests__/features/ideas-accordion.test.tsx:82 — US4 scénario 4 sans test : flèches d'ordre utilisables catégorie repliée, idées repliées intouchables. Correction : appuyer sur « Monter Jeux » repliée et vérifier `reorderTypes`, vérifier `pointerEvents` sur `list.category-books-content`.
- [x] mobile/__tests__/features/ideas-accordion.test.tsx:82 — Quickstart US4 étape 4 sans test : une catégorie dépliée réordonnée garde son état. Correction : déplier « Livres », refaire le rendu avec les `sortOrder` inversés, vérifier `expanded: true`.
- [x] mobile/__tests__/features/ideas-accordion.test.tsx:82 — Hauteur d'une catégorie dépliée qui suit son contenu (idée ajoutée ou déplacée) sans test. Correction : `layout` sur `list.category-books-content-measure` après un rendu avec une idée de plus, vérifier la hauteur.
- [x] mobile/__tests__/features/ideas-accordion.test.tsx:82 — US4 scénario 2 : « réduire les animations » non testé pour les catégories. Correction : test avec le mock à `true`, sans `Animated.timing`.
- [x] mobile/.maestro/exclusions.md:32 — US3 scénario 4 (hors ligne) et US4 scénario 2 (animation, réduire les animations) ne sont pas joués par `009-us3` / `009-us4` et ne sont pas listés. Correction : ajouter ces deux lignes.
- [x] specs/009-account-cards-expand/quickstart.md:3 — Le paragraphe sur ce que rejoue la suite e2e ne cite ni `009-us3` ni `009-us4`. Correction : les ajouter avec leurs étapes.
- [x] mobile/.maestro/flows/009-us4-ideas-categories.yaml:22 — Le parcours vise l'en-tête par son texte plutôt que `list.category-<id>`, et ne vérifie pas le scénario 3 (les autres catégories gardent leur état). Correction : viser l'id de la catégorie de démo, déplier une seconde catégorie avant de replier « Maison ».

## Constitution et sécurité

Aucun point.

## Duplication

- [x] mobile/src/ui/Card.tsx:72 — `CollapsibleCard` lit à nouveau « réduire les animations », comme `mobile/src/ui/LiveGiftMark.tsx:18-31` ; deux implémentations, et seule la nouvelle suit les changements du réglage. Correction : un hook partagé `useReduceMotion()` dans `mobile/src/ui/` (version avec abonnement), utilisé par `CollapsibleCard` et `LiveGiftMark`.
- [x] mobile/.maestro/flows/006-us2-legal.yaml:51 — Revue partielle. Le bloc « défiler jusqu'à `account.data-toggle` puis le toucher » est copié dans `006-us2`, `006-us3` et `006-us4`. Correction : un sous-parcours `subflows/open-account-data.yaml`.
- [x] mobile/.maestro/flows/009-us4-ideas-categories.yaml:22 — Le dépliage refait ce que fait `subflows/open-category.yaml`. Correction : l'utiliser pour déplier, garder le `tapOn` direct pour le repli.
- [x] mobile/src/ui/Accordion.tsx:13 — L'écran des licences (`mobile/app/legal/licenses.tsx:14-19`, `mobile/src/ui/ContentSection.tsx:17-34`) garde son propre repliage, sans animation ni « réduire les animations ». Correction : faire passer `ContentSection` par `useAccordion` / `AccordionChevron` / `AccordionContent`, ou noter dans la spec que les licences restent hors de cette mécanique.

## Conventions

Aucun point.

## i18n

Aucun point.
