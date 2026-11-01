# Implementation Plan: Cartes repliables sur l'écran de compte de l'app

**Branch**: `009-account-cards-expand` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-account-cards-expand/spec.md`

## Summary

Sur l'écran « Mon compte » de l'app mobile, les cartes « Profil » et « Modifier le mot de passe » s'affichent repliées et se déplient par un appui animé sur leur en-tête. On ajoute à `mobile/src/ui/Card.tsx` une variante repliable (`CollapsibleCard`), pendant mobile de l'accordéon du site (`components/ui/accordion.tsx`) : la carte garde sa bordure et son ombre, l'en-tête devient un bouton avec un chevron, et le contenu est animé en hauteur avec l'API `Animated` de React Native, déjà utilisée par `LiveGiftMark`. Aucune nouvelle dépendance, aucun changement du site, de l'API ni des données.

## Technical Context

**Language/Version**: TypeScript 5, React Native 0.88 (Expo SDK 58, New Architecture)

**Primary Dependencies**: `react-native` (`Animated`, `Easing`, `AccessibilityInfo`, `Keyboard`, `Pressable`), `lucide-react-native` (chevron, déjà présent). Pas de `react-native-reanimated` (voir [research.md](research.md#r1--moteur-danimation)).

**Storage**: N/A (état d'affichage local à l'écran, non persisté)

**Testing**: jest-expo + Testing Library (`mobile/__tests__/ui/`, `mobile/__tests__/screens/account.test.tsx`) ; parcours Maestro `mobile/.maestro/flows/009-us1-*.yaml`, `009-us2-*.yaml`

**Target Platform**: iOS et Android (app Expo `mobile/`)

**Project Type**: app mobile, cliente de l'API existante

**Performance Goals**: animation de 200 ms (durée de l'accordéon du site), fluide sur un téléphone d'entrée de gamme ; < 500 ms exigé par la spec (SC-003)

**Constraints**: un écran n'écrit aucun style en dur (AGENTS.md) ; textes dans `locales/{fr,en}/mobile.json` ; actions ciblées par des `testID` `<écran>.<élément>` ; préférence « réduire les animations » respectée

**Scale/Scope**: un composant d'UI, un écran, deux parcours e2e

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
| --- | --- | --- |
| I. Données personnelles hors dépôt | Aucune donnée ajoutée ; les parcours e2e utilisent les comptes fictifs `@example.test` de la démo ou un compte créé par la suite. | ✅ |
| II. Lecture sans compte, écriture par les membres | Écran déjà réservé aux personnes connectées ; aucun droit modifié. | ✅ |
| III. Réservation sans collision | Non concerné. | ✅ |
| IV. Tranches testables | US1 (Profil) livrable et vérifiable seule ; US2 (Mot de passe) réutilise le composant. Chaque story a son parcours Maestro et sa section de [quickstart.md](quickstart.md). | ✅ |
| V. Simplicité | Pas de dépendance ajoutée ; un composant réutilisable dans `mobile/src/ui/`. Le mécanisme sert à lire l'écran de compte, pas à autre chose. | ✅ |
| Hébergement Docker | Aucun changement serveur, aucune variable d'environnement. | ✅ |
| Workflow | Spec sans framework ; les choix techniques sont dans ce plan. | ✅ |

Re-check après Phase 1 : inchangé, aucune violation.

## Project Structure

### Documentation (this feature)

```text
specs/009-account-cards-expand/
├── plan.md              # Ce fichier
├── research.md          # Phase 0
├── data-model.md        # Phase 1 (état d'affichage, pas de donnée persistée)
├── quickstart.md        # Phase 1 (parcours à la main)
├── contracts/
│   └── collapsible-card.md   # Contrat du composant d'UI et des testID
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
mobile/
├── src/ui/Card.tsx                         # + CollapsibleCard (en-tête bouton, chevron, contenu animé)
├── src/features/account/PasswordForm.tsx   # + testID des champs et du bouton (parcours 009-us2)
├── app/(app)/account.tsx                   # Profil et Mot de passe passent en CollapsibleCard
├── app/dev/catalog.tsx                     # + exemple de CollapsibleCard dans le catalogue
├── __tests__/ui/components.test.tsx        # + tests du composant (replié, déplié, a11y, reduce motion)
├── __tests__/screens/account.test.tsx      # + cartes repliées à l'ouverture, message visible après envoi
├── __tests__/e2e/coverage.test.ts          # + "009" dans la table des specs
└── .maestro/flows/
    ├── 009-us1-profile-card.yaml           # déplier, renommer, confirmation, replier
    └── 009-us2-password-card.yaml          # déplier, changer le mot de passe, succès

locales/fr/mobile.json, locales/en/mobile.json   # + mobile:collapsible.expand / collapse
```

**Structure Decision**: tout se passe dans `mobile/`. Le composant vit dans `mobile/src/ui/Card.tsx` à côté de `Card`, `CardHeader`, etc., parce qu'il en reprend la boîte et les marges ; l'écran ne fait que le composer. Le site (`app/compte/page.tsx`) n'est pas touché.

## Complexity Tracking

Aucune violation à justifier.
