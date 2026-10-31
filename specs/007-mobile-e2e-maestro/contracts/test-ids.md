# Contrat : identifiants de test (`testID`)

## Convention

- Forme : `<écran>.<élément>` en minuscules et kebab-case, par exemple `login.email` ou `item-form.price`.
- `<écran>` reprend le nom de la route Expo Router, sans groupe ni paramètre : `login`, `register`, `lists`, `list`, `item-form`, `share`, `account`, `delete-account`, `legal-licenses`…
- Chaque écran a un identifiant `<écran>.screen` sur son conteneur. Les parcours l'attendent pour savoir que l'écran est prêt.
- Identifiants dynamiques : un préfixe fixe suivi d'un identifiant de donnée stable, par exemple `lists.card-<listId>` ou `list.item-<itemId>`. Le test des identifiants (R14) accepte un `id:` de parcours qui correspond à un préfixe déclaré en littéral dans le code (`` testID={`lists.card-${list.id}`} ``). Un parcours qui ne connaît pas l'identifiant (donnée qu'il vient de créer) vise le texte qu'il a saisi, avec son suffixe unique.
- Les identifiants qui existent déjà restent tels quels (liste ci-dessous). `Button` pose aussi `<testID>-box` sur sa boîte ; une `Card` cliquable pose son identifiant sur sa boîte.
- Un composant de `mobile/src/ui/` qui ne transmet pas encore `testID` à l'élément touché le transmet, sans autre changement (FR-017).
- Les écrans posent l'identifiant ; les composants de `src/ui/` n'en inventent pas.

## Identifiants par écran

Identifiants posés par l'implémentation. Ceux qui existaient avant la 007 sont gardés tels quels : `open-account`, `delete-account`, `enrich`, `form-error`, `copy-link`, `qr-code`, `password-notice`, `offline-banner`, `pending-badge` et `tab-<key>`.

| Écran | Identifiants |
|-------|--------------|
| `(auth)/login` | `login.screen`, `login.email`, `login.password`, `login.submit`, `login.error`, `login.deleted`, `login.create-account`, `login.forgot` ; sous la carte : `legal-links.mentions`, `legal-links.privacy` |
| `(auth)/forgot-password` | `forgot.screen`, `forgot.email`, `forgot.submit`, `forgot.sent`, `forgot.back` |
| `(auth)/register` | `register.screen`, `register.name`, `register.email`, `register.password`, `register.submit`, `register.error`, `register.sent`, `register.sent-continue` |
| `(app)/index` | `lists.screen`, `lists.new`, `lists.empty`, `lists.card-<listId>`, `open-account` |
| `(app)/lists/new` | `new-list.screen`, `new-list.title`, `new-list.category`, `new-list.person`, `new-list.submit`, `new-list.error` |
| écran d'une liste (tous les onglets) | `list.screen`, `back-link.back`, `tab-<key>` (`idees`, `archives`, `reservations`, `partage`, `reglages`) |
| onglet Idées | `list.add-item`, `list.category-<typeId>`, `list.item-<itemId>`, `item-card.edit`, `item-card.archive` |
| `items/new` et `items/[itemId]` | `item-form.screen`, `item-form.url`, `enrich`, `item-form.name`, `item-form.price`, `form-error`, `item-form.submit`, `item-form.delete`, `item-form.delete-confirm` |
| onglet Archives | `archives.item-<itemId>`, `archives.restore`, `archives.delete` |
| onglet Réservations | `reservations.item-<reservationId>`, `reservations.note-<reservationId>` |
| onglet Réglages | `settings.types-new`, `settings.types-add`, `settings.types-delete-<typeId>`, `settings.types-error`, et les mêmes en `settings.people-…` |
| onglet Partage | `qr-code`, `share.share`, `share.read-link`, `copy-link`, `share.copied` |
| `(app)/account` | `account.screen`, `back-link.back`, `account.name`, `account.save-name`, `account.legal`, `account.privacy`, `account.export`, `account.export-error`, `account.licenses`, `account.contact`, `account.version`, `account.logout`, `account.logout-confirm` (et `-keep`), `delete-account` |
| `(app)/delete-account` | `delete-account.screen`, `delete-account.summary`, `delete-account.password`, `delete-account.error`, `delete-account.confirm`, `delete-account.cancel` |
| `legal/*` | `legal-mentions.screen`, `legal-privacy.screen`, `legal-licenses.screen` (pas d'identifiant par ligne de licence : le parcours vérifie qu'une ligne « version · licence » est affichée) |

Composants qui transmettent un identifiant :

- `Screen` et `ScreenList` le posent sur leur conteneur ;
- `AuthLayout` et `LegalScreen` le passent à `Screen` ;
- `Field` pose `errorTestID` sur son message d'erreur ;
- `Empty` le pose sur son conteneur ;
- `ConfirmDialog` le pose sur le bouton d'action, et `<testID>-keep` sur « Conserver » ;
- `BackLink` porte toujours `back-link.back`.

## Règles vérifiées par les tests

- Chaque `id:` d'un parcours de `mobile/.maestro/flows/` ou `subflows/` correspond à un `testID` (ou une prop `…TestID`) du code, en littéral ou par un préfixe dynamique. Exceptions, absentes du code de l'app : la feuille de partage d'iOS (`ShareSheet.RemoteContainerView`, `PopoverDismissRegion`), le menu développeur du dev client (`xmark`) et les identifiants d'Android (`<paquet>:id/<nom>`). Les suffixes `-box` (`Button`) et `-keep` (`ConfirmDialog`) sont acceptés (test `mobile/__tests__/e2e/test-ids.test.ts`).
- Un `testID` ne contient ni texte traduit ni donnée personnelle (adresse e-mail, nom) : seulement des identifiants techniques.
