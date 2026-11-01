# Contrat : `CollapsibleCard` (app mobile)

Composant d'UI de `mobile/src/ui/Card.tsx`, pendant mobile de l'accordéon du site (`components/ui/accordion.tsx`) appliqué à une carte. Pas d'API réseau : ce contrat fixe ce que l'écran de compte, les tests et les parcours Maestro peuvent attendre du composant.

## Pièces communes (`mobile/src/ui/Accordion.tsx`)

`CollapsibleCard` et les catégories de l'onglet Idées (`IdeasAccordion`) partagent la mécanique de l'accordéon :

- `useAccordion(defaultExpanded?)` → `{ expanded, toggle, progress }` : état, animation de 200 ms, réduire les animations, clavier fermé au repli ;
- `AccordionChevron({ progress, color?, testID? })` : le chevron qui pivote ;
- `AccordionContent({ expanded, progress, style?, testID? })` : contenu monté, mesuré (`<testID>-measure`), caché aux lecteurs d'écran et aux appuis quand il est replié.

`useAccordion` rend aussi `shown` (contenu à l'écran, `false` une fois le repli fini) ; `AccordionContent` prend `mounted` (défaut `true`). Les catégories d'idées et les licences passent `mounted={shown}` : leur contenu n'est monté que déplié. Les cartes du compte gardent le leur monté (la saisie survit à un repli). Les licences utilisent `CollapsibleContentSection` (`mobile/src/ui/ContentSection.tsx`).

Chaque appelant garde son en-tête (bouton avec `accessibilityState={{ expanded }}`). Catégories : `list.category-<id>` (en-tête, inchangé), `list.category-<id>-chevron`, `list.category-<id>-content`.

## Props

| Prop | Type | Obligatoire | Rôle |
| --- | --- | --- | --- |
| `title` | `string` | oui | Titre de la carte (`CardTitle`), aussi libellé accessible de l'en-tête. |
| `description` | `string` | non | Description sous le titre (`CardDescription`), visible repliée. |
| `children` | `ReactNode` | oui | Contenu replié ; reçu tel quel dans un `CardContent`. |
| `defaultExpanded` | `boolean` | non (`false`) | État au montage. |
| `contentStyle` | `StyleProp<ViewStyle>` | non | Style du `CardContent` (par exemple `alignItems: "flex-start"` pour une liste de liens). |
| `testID` | `string` | non | Base des identifiants de test (voir plus bas). |

Pas de mode contrôlé : l'écran n'a pas besoin de lire ni d'imposer l'état.

## Comportement

- Apparence de `Card` : fond, bordure de 2, ombre décalée, marges de 16. L'en-tête ne s'enfonce pas à l'appui (seule la zone d'en-tête réagit, pas toute la carte).
- Chevron `ChevronDownIcon` à droite de l'en-tête (slot `action` de `CardHeader`), taille et couleur du chevron de `Select` ; il pivote de 180° quand la carte est dépliée.
- Appui sur l'en-tête : bascule `expanded`, anime la hauteur, l'opacité du contenu et le chevron en 200 ms ([research.md R1–R3](../research.md)).
- Réduire les animations actif : bascule sans animation ([R4](../research.md#r4--réduire-les-animations)).
- Replié : contenu caché aux lecteurs d'écran et non touchable ; au repli, le clavier se ferme ([R5](../research.md#r5--accessibilité)).
- Le contenu reste monté : la saisie et l'état des formulaires survivent à un repli.

## Accessibilité

| Élément | Rôle | État | Libellé | Indice |
| --- | --- | --- | --- | --- |
| En-tête | `button` | `{ expanded }` | `title` | `mobile:collapsible.expand` / `mobile:collapsible.collapse` |

## Identifiants de test

Avec `testID="account.profile"` :

| testID | Élément |
| --- | --- |
| `account.profile` | La carte |
| `account.profile-toggle` | L'en-tête (bouton) |
| `account.profile-content` | Le conteneur du contenu |
| `account.profile-chevron` | L'indicateur de dépliage (chevron) |
| `account.profile-content-measure` | La vue mesurée du contenu (tests) |

Sur l'écran de compte : `account.profile`, `account.password` et `account.data`. Le formulaire de mot de passe gagne `account.password-current`, `account.password-next`, `account.password-confirm`, `account.password-submit` : `PasswordForm` reçoit une prop optionnelle `testID` (ici `account.password`) dont il dérive ces quatre identifiants. L'écran de changement imposé ne la passe pas et reste inchangé.

## Textes

| Clé | fr | en |
| --- | --- | --- |
| `mobile:collapsible.expand` | Déplier | Expand |
| `mobile:collapsible.collapse` | Replier | Collapse |
