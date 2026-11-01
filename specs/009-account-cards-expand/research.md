# Research: Cartes repliables sur l'écran de compte de l'app

## R1 — Moteur d'animation

- **Decision**: API `Animated` de React Native : une valeur de 0 à 1 qui pilote la hauteur du conteneur (`interpolate` vers la hauteur mesurée du contenu), l'opacité du contenu et la rotation du chevron. `useNativeDriver: false` pour la hauteur (propriété de mise en page), comme l'exige `Animated`.
- **Rationale**: déjà utilisée dans l'app (`mobile/src/ui/LiveGiftMark.tsx`), aucune dépendance native à ajouter ni de rebuild des binaires avant la publication sur les stores. Pour une carte et 200 ms, animer la hauteur côté JS reste fluide.
- **Alternatives considered**:
  - `react-native-reanimated` (animations sur le thread UI, `layout` animations) : plus puissant, mais nouvelle dépendance native, configuration Babel et nouvelle licence à lister pour un seul composant. Rejeté (principe V).
  - `LayoutAnimation` : une ligne, mais anime toute la mise en page de l'écran au prochain rendu (y compris les messages d'alerte), sans contrôle fin, et son support Android sous la New Architecture reste irrégulier. Rejeté.

## R2 — Mesure de la hauteur du contenu

- **Decision**: le contenu est toujours monté. Il est rendu dans une vue intérieure en `position: absolute` (haut, gauche, droite à 0) dont `onLayout` donne la hauteur naturelle ; le conteneur extérieur `overflow: hidden` prend la hauteur animée. Si la hauteur change pendant que la carte est ouverte (alerte de succès ou d'erreur qui apparaît), le conteneur la suit sans animation.
- **Rationale**: garder le contenu monté conserve la saisie quand on replie puis redéplie (edge case de la spec) et l'état interne de `PasswordForm`. La vue absolue mesure le contenu sans être contrainte par la hauteur animée.
- **Alternatives considered**: démonter le contenu replié (perd la saisie, empêche d'animer la fermeture) ; hauteur maximale fixe (animation faussée, contenu coupé). Rejetés.

## R3 — Durée et courbe

- **Decision**: 200 ms, `Easing.out(Easing.quad)` à l'ouverture comme à la fermeture ; chevron de 0° à 180°.
- **Rationale**: c'est la durée par défaut des animations `accordion-down` / `accordion-up` de `tw-animate-css` qu'utilise l'accordéon du site, ce qui garde l'app proche du site ; bien sous la limite de 500 ms (SC-003).
- **Alternatives considered**: ressort (`Animated.spring`) : rebond hors du style néobrutaliste du site. Rejeté.

## R4 — Réduire les animations

- **Decision**: lire `AccessibilityInfo.isReduceMotionEnabled()` au montage et s'abonner à `reduceMotionChanged`. Avec la préférence active, la valeur passe directement à 0 ou 1 (pas d'animation de hauteur ni de rotation).
- **Rationale**: même source que `LiveGiftMark`, avec en plus l'abonnement pour suivre un changement de réglage pendant que l'écran est ouvert. FR-004, SC-005.

## R5 — Accessibilité

- **Decision**:
  - L'en-tête est un `Pressable` avec `accessibilityRole="button"`, `accessibilityState={{ expanded }}`, `accessibilityLabel` = titre de la carte et `accessibilityHint` = « Déplier » / « Replier » (`mobile:collapsible.*`).
  - Le contenu replié porte `accessibilityElementsHidden` (iOS), `importantForAccessibility="no-hide-descendants"` (Android) et `pointerEvents="none"`.
  - Au repli, `Keyboard.dismiss()` ferme le clavier si un champ de la carte a le focus.
- **Rationale**: VoiceOver et TalkBack annoncent « bouton, réduit / développé » à partir de `expanded` (FR-005, SC-004) ; le contenu caché n'est ni lu ni atteignable (FR-006). Le titre reste un `CardTitle` (`accessibilityRole="header"`) pour la navigation par titres.

## R6 — Retour après un envoi

- **Decision**: rien à faire de spécial. Sur l'app, un envoi ne recharge pas l'écran : la carte reste dans son état (dépliée) et le message apparaît dans le contenu, dont la hauteur est suivie (R2).
- **Rationale**: FR-007 est satisfait par construction ; on le couvre par un test d'écran.

## R7 — Parcours e2e

- **Decision**: deux parcours `009-us1-profile-card.yaml` et `009-us2-password-card.yaml`. US1 se connecte avec un compte de démo ; US2 se connecte avec `alex@example.test` et vérifie le dépliage (replié, trois champs visibles, ouvert avec Profil, replié) sans envoyer le formulaire : sur le simulateur iOS, Maestro ne parvient pas à remplir ces champs sécurisés (déjà vrai avec une carte simple, avant la 009). L'envoi est une ligne de `exclusions.md` ; le message dans la carte ouverte est couvert par un test d'écran. `coverage.test.ts` ajoute `"009"` à sa table de specs.
- **Rationale**: règle d'AGENTS.md (une story mobile = un parcours, tag `<feature>-us<N>`). Les parcours existants qui passent par l'écran de compte visent des éléments hors des cartes Profil et Mot de passe. Avec US3, `006-us2`, `006-us3` et `006-us4` déplient d'abord la carte « Vos données et informations » (`account.data-toggle`) ; `005-us5` (déconnexion) ne change pas.
