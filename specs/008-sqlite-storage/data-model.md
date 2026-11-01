# Data Model: Stockage des données dans une base embarquée

Le modèle métier ne change pas : chaque table correspond à une collection de `Database` (`src/domain/types.ts`), chaque colonne à un champ, avec le même nom en `snake_case`. Le schéma est décrit dans `src/store/schema.ts` (Drizzle) ; les migrations sont générées dans `drizzle/`.

Conventions communes :

- Identifiants et jetons : `text`, tels quels (aucun identifiant n'est regénéré à l'import).
- Dates : `text` au format ISO 8601, telles quelles (le domaine les compare en chaîne ou les relit avec `new Date`).
- Booléens : `integer` en mode booléen Drizzle (0/1).
- Ordre : l'ordre des tableaux est rendu par `ORDER BY rowid` (voir [research.md](./research.md#r6-ordre-des-enregistrements)) ; aucune colonne de position n'est ajoutée.
- Clés étrangères : déclarées, vérifiées au `COMMIT` (différées). **Pas de `ON DELETE CASCADE`** : à l'étape 1, c'est le domaine qui supprime les lignes liées, comme aujourd'hui ; une clé étrangère qui échoue révèle un oubli du domaine au lieu de le réparer en silence.

## Tables

### `users` ← `User`

| Colonne | Type | Contraintes |
| --- | --- | --- |
| `id` | text | PK |
| `email` | text | NOT NULL, UNIQUE (déjà normalisé en minuscules par le domaine) |
| `password_hash` | text | NOT NULL |
| `display_name` | text | NOT NULL |
| `created_at` | text | NOT NULL |
| `must_change_password` | integer (bool) | NOT NULL, défaut 0 |
| `session_version` | integer | NOT NULL, défaut 0 |

### `wishlists` ← `Wishlist`

| Colonne | Type | Contraintes |
| --- | --- | --- |
| `id` | text | PK |
| `title` | text | NOT NULL |
| `subtitle` | text | NULL |
| `cover_image_url` | text | NULL |
| `theme` | text (JSON) | NOT NULL — `{ primary, accent, highlight, background }`, passé par `resolveTheme` à l'import |
| `read_token` | text | NOT NULL, UNIQUE |
| `invite_token` | text | NOT NULL, UNIQUE |
| `read_password_hash` | text | NULL |
| `from_template` | integer (bool) | NOT NULL |
| `created_at` | text | NOT NULL |

Le thème reste une valeur JSON : il est toujours lu et écrit d'un bloc, jamais filtré.

### `memberships` ← `Membership`

| Colonne | Type | Contraintes |
| --- | --- | --- |
| `wishlist_id` | text | FK → `wishlists.id` |
| `user_id` | text | FK → `users.id` |
| `role` | text | NOT NULL, `owner` ou `member` |
| `joined_at` | text | NOT NULL |

PK composée (`wishlist_id`, `user_id`). Index sur `user_id` (listes d'un compte).

### `types` ← `WishType` (libellés de catégorie)

| Colonne | Type | Contraintes |
| --- | --- | --- |
| `id` | text | PK |
| `wishlist_id` | text | NOT NULL, FK → `wishlists.id`, index |
| `label` | text | NOT NULL |
| `sort_order` | integer | NOT NULL, défaut 0 |

### `people` ← `Person`

| Colonne | Type | Contraintes |
| --- | --- | --- |
| `id` | text | PK |
| `wishlist_id` | text | NOT NULL, FK → `wishlists.id`, index |
| `label` | text | NOT NULL |

### `views` ← `View`

| Colonne | Type | Contraintes |
| --- | --- | --- |
| `id` | text | PK |
| `wishlist_id` | text | NOT NULL, FK → `wishlists.id`, index |
| `label` | text | NOT NULL |
| `kind` | text | NOT NULL, `all`, `types` ou `person` |
| `type_ids` | text (JSON) | NOT NULL, tableau d'identifiants de `types` |
| `person_id` | text | NULL, FK → `people.id` |
| `pinned` | integer (bool) | NOT NULL |

`type_ids` reste un tableau JSON : toujours lu avec sa vue, jamais interrogé seul. L'import vérifie que chaque identifiant existe ; le domaine garde cette cohérence ensuite.

### `items` ← `Item` (idées)

| Colonne | Type | Contraintes |
| --- | --- | --- |
| `id` | text | PK |
| `wishlist_id` | text | NOT NULL, FK → `wishlists.id`, index |
| `name` | text | NOT NULL |
| `type_id` | text | NOT NULL, FK → `types.id` |
| `url` | text | NULL |
| `image_url` | text | NULL |
| `price_cents` | integer | NULL |
| `priority` | text | NULL |
| `person_id` | text | NOT NULL, FK → `people.id` |
| `sort_order` | integer | NOT NULL |
| `archived` | integer (bool) | NOT NULL, défaut 0 |

### `reservations` ← `Reservation`

| Colonne | Type | Contraintes |
| --- | --- | --- |
| `id` | text | PK |
| `wishlist_id` | text | NOT NULL, FK → `wishlists.id`, index |
| `item_id` | text | NOT NULL, FK → `items.id`, **UNIQUE** |
| `from_name` | text | NULL |
| `note` | text | NULL |
| `user_id` | text | NULL, FK → `users.id` |
| `created_at` | text | NOT NULL |

L'index unique sur `item_id` inscrit le principe III (« deux personnes ne doivent pas pouvoir confirmer la même idée ») dans la base, en plus de la règle du domaine. La suppression d'un compte met `user_id` à `NULL` (domaine, `deleteAccount`), ce que la clé étrangère accepte.

### `password_resets` ← `PasswordReset`

| Colonne | Type | Contraintes |
| --- | --- | --- |
| `id` | text | PK |
| `user_id` | text | NOT NULL, FK → `users.id`, index |
| `token_hash` | text | NOT NULL, UNIQUE |
| `expires_at` | text | NOT NULL |
| `created_at` | text | NOT NULL |

### `api_sessions` ← `ApiSession`

| Colonne | Type | Contraintes |
| --- | --- | --- |
| `id` | text | PK |
| `user_id` | text | NOT NULL, FK → `users.id`, index |
| `token_hash` | text | NOT NULL, UNIQUE |
| `session_version` | integer | NOT NULL |
| `created_at` | text | NOT NULL |
| `expires_at` | text | NOT NULL |

Les sessions et réinitialisations expirées sont importées telles quelles ; le domaine continue de les refuser par leur date.

### `meta` (nouvelle, technique)

| Colonne | Type | Contraintes |
| --- | --- | --- |
| `key` | text | PK |
| `value` | text | NOT NULL |

Clés : `legacy_import` = `imported:<date ISO>` ou `none`. La table de suivi des migrations est celle de Drizzle (`__drizzle_migrations`).

## Correspondance champ ↔ colonne

La conversion ligne ↔ objet est écrite une fois par table dans `src/store/rows.ts` (`toRow`/`fromRow`). Un test vérifie l'aller-retour de chaque collection sur `apiDoc()` et sur la base de démo : `fromRow(toRow(x))` est égal à `x`.

## Normalisation à l'import

`normalizeDocument` (aujourd'hui dans `src/store/db.ts`) passe dans `src/store/legacy-json.ts` et ne s'applique plus qu'à l'import : `passwordResets` et `apiSessions` absents → `[]` ; `mustChangePassword` → `false` ; `sessionVersion` → `0` ; `subtitle`, `coverImageUrl`, `readPasswordHash`, `imageUrl`, `reservation.userId` → `null` ; `archived` → `false` ; `theme` → `resolveTheme` ; `sortOrder` des libellés recalculé quand tous valent 0 dans une liste. Après l'import, les colonnes `NOT NULL` avec défaut rendent cette normalisation inutile à la lecture.

## Contrôle d'intégrité (import et `db:check`)

L'import s'arrête, sans rien écrire, si l'un de ces contrôles échoue ; le message nomme la collection et les identifiants (jamais un e-mail ni un nom) :

1. Fichier lisible et JSON valide ; `users`, `wishlists`, `memberships`, `types`, `people`, `views`, `items`, `reservations` présents et en tableaux (`passwordResets`, `apiSessions` peuvent manquer).
2. Pas d'identifiant en double dans une collection ; pas d'adhésion en double (liste, compte).
3. Pas d'e-mail, de `readToken`, d'`inviteToken`, de `tokenHash` en double.
4. Au plus une réservation par idée.
5. Chaque référence pointe vers un enregistrement existant : `wishlistId`, `userId` (adhésions, sessions, réinitialisations, réservations non nulles), `typeId`, `personId`, `itemId`, `view.typeIds`, `view.personId`.

## Portées de l'étape 2

Une portée est un `Database` partiel, chargé par requêtes ciblées. Le contrat et les fonctions du domaine servies sont dans [contracts/store.md](./contracts/store.md).

| Portée | Lignes chargées |
| --- | --- |
| `list(wishlistId)` | la liste, ses adhésions et les comptes de ses membres, ses libellés, personnes, vues, idées, réservations |
| `listByReadToken(token)` / `listByInviteToken(token)` | comme `list`, retrouvée par son jeton |
| `user(userId)` | le compte, ses adhésions et, pour chacune, la ligne de la liste (titre, thème) |
| `userByEmail(email)` | le compte qui a cet e-mail, s'il existe |
| `account(userId)` | `user(userId)` + chaque liste dont il est membre en portée `list` + ses sessions et réinitialisations + les réservations qu'il a faites |
| `apiSession(tokenHash)` | la session et son compte |
| `passwordReset(tokenHash)` | la demande et son compte |

Les compteurs, enchaînements de statut et règles ne changent pas : il n'y a pas de nouvel état métier dans cette feature.
