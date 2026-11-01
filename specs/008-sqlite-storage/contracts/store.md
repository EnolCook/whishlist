# Contrat : module de stockage (`src/store/`)

Le contrat de l'API HTTP (`specs/004-mobile-api/contracts/openapi.yaml`) **ne change pas** (FR-019) : aucune route, aucun champ, aucun code d'erreur ne bouge, et `tests/domain/api-contract.test.ts` reste inchangé. La seule interface qui évolue est celle du store, que les commandes, les pages, les scripts et les tests appellent. Ce fichier la décrit.

## Étape 1 — `src/store/db.ts` (signatures conservées)

```ts
/** Chemin de l'ancien fichier JSON (`WISHLIST_DATA_PATH`, défaut `data/wishlist.json`). Inchangé. */
export function dataFilePath(): string;

/** Chemin de la base : `dataFilePath()` avec l'extension `.db` (tel quel s'il finit déjà par `.db`). */
export function databaseFilePath(): string;

/** Lecture complète, instantané cohérent (connexion lecteur). Ordre des tableaux = ordre d'insertion. */
export async function readDocument(): Promise<Database>;

/** Une lecture par requête RSC. Inchangé. */
export const getDocument: () => Promise<Database>;

/**
 * Modification sous protection. Inchangé pour l'appelant :
 * - un seul `updateDocument` à la fois par base (file en mémoire + `BEGIN IMMEDIATE`) ;
 * - `mutate` peut être asynchrone et peut modifier `doc` en place ou en rendre un autre ;
 * - seules les lignes ajoutées, modifiées ou retirées sont écrites ;
 * - tout ou rien : si `mutate` lève ou si une contrainte échoue, rien n'est écrit et l'erreur remonte.
 */
export async function updateDocument<T>(
  mutate: (doc: Database) => { doc: Database; result: T } | Promise<{ doc: Database; result: T }>,
): Promise<T>;

/** Nouveau. Remplace tout le contenu en une transaction (démo, remise à zéro de l'e2e, tests). */
export async function replaceDocument(doc: Database): Promise<void>;
```

## Étape 1 — `src/store/connection.ts` (nouveau)

```ts
/**
 * Ouvre (une fois par chemin et par processus) les connexions écrivain et lecteur,
 * règle WAL / foreign_keys / busy_timeout, applique les migrations de `drizzle/`,
 * puis fait l'import de l'ancien fichier si `meta.legacy_import` manque.
 * Lève `LegacyImportError` (liste des problèmes) si le fichier est illisible ou incohérent.
 */
export function openStore(path?: string): Store;

/** Ferme les connexions (tests, fin de script). */
export function closeStore(path?: string): void;
```

Appelé par `instrumentation.ts` au démarrage du serveur (échec → message + `process.exit(1)`), et implicitement par le premier appel de `readDocument`/`updateDocument` dans les scripts et les tests.

## Étape 1 — `src/store/legacy-json.ts` (nouveau)

```ts
export class LegacyImportError extends Error {
  /** Un problème par ligne : collection, identifiant(s), nature. Jamais d'e-mail ni de nom. */
  readonly problems: string[];
}

/** Lit, normalise et contrôle un ancien fichier. Ne modifie jamais le fichier. */
export function loadLegacyDocument(file: string): Database; // lève LegacyImportError

/** Contrôle d'intégrité seul (utilisé par l'import et par `npm run db:check`). */
export function checkDocument(doc: Database): string[];
```

## Étape 2 — `src/store/scopes.ts` (nouveau)

```ts
export type Scope =
  | { kind: "list"; wishlistId: string }
  | { kind: "listByReadToken"; token: string }
  | { kind: "listByInviteToken"; token: string }
  | { kind: "user"; userId: string }
  | { kind: "userByEmail"; email: string }
  | { kind: "account"; userId: string }
  | { kind: "apiSession"; tokenHash: string }
  | { kind: "passwordReset"; tokenHash: string };

/** `Database` partiel : seulement les lignes de la portée (voir data-model.md, « Portées »). */
export async function readScope(scope: Scope | Scope[]): Promise<Database>;

/** `readScope` mis en cache pour une requête RSC (clé = portée sérialisée). */
export const getScope: (scope: Scope) => Promise<Database>;

/**
 * Comme `updateDocument`, sur une portée : la portée est relue dans la transaction d'écriture,
 * et le différentiel ne touche que les lignes chargées (une ligne hors portée n'est jamais effacée).
 * Une violation d'unicité est traduite par `onConflict` dans l'erreur que le domaine rend déjà.
 */
export async function updateScope<T>(
  scope: Scope | Scope[],
  mutate: (doc: Database) => { doc: Database; result: T } | Promise<{ doc: Database; result: T }>,
  options?: { onConflict?: (constraint: "email" | "reservationItem" | "token") => T },
): Promise<T>;
```

Règles d'emploi :

- Une commande choisit la plus petite portée qui contient **tout ce que lisent** les fonctions du domaine qu'elle appelle. Le tableau ci-dessous fait foi ; le test d'équivalence (`tests/domain/store-scopes.test.ts`) le vérifie commande par commande.
- Une écriture qui touche deux listes (ex. suppression de compte) prend la portée `account`, qui les contient toutes.
- Aucun import de `readDocument`, `getDocument`, `updateDocument` ni `replaceDocument` dans `app/` ni `src/server/` après l'étape 2 (règle ESLint `no-restricted-imports`).

| Commande (`src/server/commands/`) | Portée |
| --- | --- |
| `auth.ts` : connexion, inscription, mot de passe oublié | `userByEmail` |
| `auth.ts` : jeton d'API (vérification, déconnexion) | `apiSession` |
| `auth.ts` : changement de mot de passe | `account` (périme toutes ses sessions) |
| réinitialisation par lien (`actions.ts`, page `reinitialiser`) | `passwordReset` |
| `lists.ts` : créer une liste | `user` (la nouvelle liste est ajoutée à la portée) |
| `lists.ts`, `items.ts`, `labels.ts` : lire ou modifier une liste | `list` |
| `sharing.ts` : invitation, rejoindre | `[listByInviteToken, user]` |
| `public-list.ts` : lecture publique, réservation, « Je veux offrir » | `listByReadToken` |
| `account.ts` : export, aperçu et suppression du compte | `account` |
| `src/auth/current.ts` : compte de la session du site | `user` |
| page d'accueil, « Mon compte » | `user` / `account` |

Quand une commande a besoin de deux portées (`sharing.ts`), `readScope` et `updateScope` acceptent aussi un tableau de portées : le `Database` rendu est l'union de leurs lignes, sans doublon, chargée dans la même transaction.
