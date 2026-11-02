# Data Model: Liens qui ouvrent l'app

La base SQLite n'est pas modifiée : aucune migration. Les jetons des liens (confirmation, réinitialisation, invitation, lecture) existent déjà (features 001, 004, 010). Cette feature ajoute une table de routage, une configuration et des données gardées sur le téléphone.

## Route de lien (`APP_LINK_ROUTES`, `src/site/app-links.ts`)

Module pur, partagé par le site et l'app. Table complète : [contracts/links.md](./contracts/links.md).

| Champ | Type | Règle |
| --- | --- | --- |
| `sitePattern` | chaîne, par exemple `/confirmer-email/:token` | Chemin du site sans préfixe de langue. Un `:param` vaut un segment non vide, sans `/`. |
| `appPath` | fonction `(params, query) → string` | Chemin de l'écran de l'app (`/links/confirm-email/<token>`). |
| `keepQuery` | liste de clés | Clés de requête transmises (`suite`, `next`, `itemId`, `typeId`). Les autres sont ignorées. |

Fonctions dérivées :

- `appPathForSiteUrl(url, { apiHost, scheme })` → `string | null` ;
- `appleAssociation(teamId)` → objet JSON du fichier Apple ;
- `androidAssociation(fingerprints)` → tableau JSON du fichier Android ;
- `androidPathPrefixes()` → préfixes des `intentFilters`.

Validation :

- `appPathForSiteUrl` rend `null` pour un autre hôte, un chemin non listé, un segment vide ou un `:param` qui contient `/` ;
- les deux formes `/x` et `/en/x` donnent le même résultat ;
- une empreinte Android hors du format `([0-9A-F]{2}:){31}[0-9A-F]{2}` est ignorée, et sans aucune empreinte valide la route répond 404.

## Configuration du serveur

| Variable | Format | Utilisée par |
| --- | --- | --- |
| `APPLE_TEAM_ID` | 10 caractères `[A-Z0-9]` | `/.well-known/apple-app-site-association` |
| `ANDROID_CERT_SHA256` | empreintes SHA-256 séparées par des virgules | `/.well-known/assetlinks.json` |
| `APP_STORE_URL` | URL `https://apps.apple.com/…` | badge App Store de la fenêtre |
| `PLAY_STORE_URL` | URL `https://play.google.com/…` | badge Google Play de la fenêtre |

Une valeur absente ou invalide (une URL qui n'est pas `https`) désactive l'élément concerné, sans erreur au démarrage.

## Plateforme du téléphone (`phonePlatform`, `src/site/device.ts`)

`phonePlatform(userAgent: string, uaDataMobile?: boolean) → "ios" | "android" | null`

| Entrée | Résultat |
| --- | --- |
| UA avec `iPhone` ou `iPod` | `"ios"` |
| UA avec `Android` et `Mobile`, ou `uaDataMobile === true` avec `Android` | `"android"` |
| iPad (UA « Macintosh » de Safari), tablette Android (sans `Mobile`), ordinateur | `null` |

## Sur le téléphone (app)

### Lien en attente (`mobile/src/links/pending.ts`, mémoire)

| Champ | Type | Règle |
| --- | --- | --- |
| `path` | chaîne | Chemin d'app d'un lien qui demande d'être connecté (`/links/invite/<t>`). |

États :

1. vide ;
2. `setPendingLink` par l'écran du lien sans session ;
3. lu par `afterSignIn()` dans `(auth)/_layout` et `change-password` dès que la session est ouverte (pendant le rendu, donc sans le vider : le double rendu du mode strict le perdrait) ;
4. `clearPendingLink` par l'écran du lien, une fois la session ouverte.

Un seul lien à la fois : le dernier ouvert gagne. Il est perdu à l'arrêt de l'app.

### Accès invité (`mobile/src/features/guest/storage.ts`, SecureStore)

| Donnée | Clé | Durée | Règle |
| --- | --- | --- | --- |
| Jeton de déverrouillage | par `readToken` | `expiresAt` rendu par `/unlock` (14 j) | Envoyé dans `X-Read-Unlock`. Supprimé à expiration ou sur un `423 readPasswordRequired`. |
| Claims de réservation | liste unique `{ claim, readToken, expiresAt }` | 90 j | Envoyés dans `X-Reservation-Claims` pour la liste concernée. Retirés après annulation ou expiration. |

Les deux sont effacés par `signOut` et par la suppression du compte (« oublie tout sur le téléphone »), comme la copie locale.

### Écran invité, par liste (état en mémoire, non synchronisé)

`loading` → `locked` (mot de passe demandé) → `ready` (liste) ; `missing` (404) ; `offline` (erreur réseau, réessayer).

Réserver : `ready` → `reserving` → `ready`, avec l'idée retirée des idées libres et marquée `mine`, ou une erreur (idée déjà prise : message du site, liste rechargée). Jamais mis en file hors ligne.
