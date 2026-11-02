# Contrat : ajouts à l'API (1.3.0 → 1.4.0) et au site

Delta de `specs/004-mobile-api/contracts/openapi.yaml`. Tous les ajouts sont rétrocompatibles : l'app 1.0.0 n'en dépend pas. `tests/domain/api-contract.test.ts` vérifie que chaque opération a sa route.

## `POST /auth/email-confirmation` (nouveau, tag `auth`)

Confirme un lien de confirmation d'adresse (validation ou changement), comme le bouton de `/confirmer-email/{token}`. Commande : `confirmEmailWithToken` (existante). Depuis 1.4.0.

- `security: [{}, { bearer: [] }]` : le bearer sert seulement à `ownAccount`.
- Corps : `{ token: string, suite?: string }`.
- `200` : `{ purpose: "verify" | "change", ownAccount: boolean, suite: string | null }`. `suite` est un chemin interne du site (`internalPath`), par exemple `/inviter/{t}`.
- `400` : `confirmationLinkInvalid` (inconnu, déjà utilisé, remplacé) ; `confirmationLinkExpired` ; `emailTaken` (changement vers une adresse prise entre-temps).
- `429` : limite `confirm-email` (20 par 15 min et par IP).

L'avis à l'ancienne adresse part comme sur le site (purpose `change`).

## `POST /auth/password-reset/confirm` (nouveau, tag `auth`)

Choisit le nouveau mot de passe à partir du lien de réinitialisation. Commande : `resetPasswordWithLink` (nouvelle, extraite de `resetPasswordAction`). Depuis 1.4.0.

- `security: []`.
- Corps : `{ token: string, password: string, signIn?: boolean }` (`signIn` vaut `false` par défaut).
- `200` : `{ session: Session | null }`. `session` est rempli si `signIn` est vrai, avec la même forme que la réponse de `/auth/login`.
- `400` : `passwordTooShort` (règle de `passwordPolicyError`) ; `resetLinkInvalid` (inconnu, déjà utilisé) ; `resetLinkExpired`.
- `429` : limite `password-reset-confirm` (20 par 15 min et par IP).

Effets, comme sur le site : le mot de passe change, l'adresse est marquée vérifiée (feature 010, FR-007), et les autres sessions sont invalidées par `sessionVersion`.

## `GET /invitations/{inviteToken}` (nouveau, tag `sharing`)

Aperçu d'une invitation avant de la rejoindre. Depuis 1.4.0.

- `security: [{ bearer: [] }]`.
- `200` : `{ title: string, listId: string | null }`. `listId` n'est rempli que si le compte est déjà membre.
- `401` : pas de session.
- `403` : `mustChangePassword` (comme les autres routes).
- `404` : `inviteLinkBroken` (inconnue ou révoquée, même code que `acceptInvite`).

Aucune écriture. Elle n'exige pas une adresse vérifiée : seul `accept` l'exige (`emailNotVerified`), et l'app affiche alors le bandeau de vérification.

## Descriptions mises à jour

- `/auth/password-reset`, `/me/email-verification`, `/me/email` : « Le lien envoyé ouvre l'app si elle est installée, le site sinon. »
- `info.description` : un paragraphe sur les liens de l'app, qui renvoie à `specs/011-app-deep-links/contracts/links.md`.

## Site

| Élément | Changement |
| --- | --- |
| `app/.well-known/apple-app-site-association/route.ts` | Nouveau, [links.md](./links.md). |
| `app/.well-known/assetlinks.json/route.ts` | Nouveau, [links.md](./links.md). |
| `proxy.ts` (`matcher`) | Exclut `.well-known/`. |
| `src/server/actions.ts` `resetPasswordAction` | Appelle `resetPasswordWithLink`. Le comportement ne change pas, sauf la limite de débit ajoutée (redirection `?e=rate`). |
| `app/layout.tsx` | Rend `GetAppButton` dans l'en-tête quand `APP_STORE_URL` ou `PLAY_STORE_URL` est réglé. |
| `components/site/get-app-button.tsx` | Nouveau : bouton icône animé et fenêtre des stores ([research R13](../research.md#r13-icône--lapp-sur-votre-téléphone--du-site)). |

## Variables d'environnement (toutes optionnelles)

| Variable de l'app | Variable de `compose.prod.yml` | Effet sans valeur |
| --- | --- | --- |
| `APPLE_TEAM_ID` | `WHISHLIST_APPLE_TEAM_ID` | Pas de fichier Apple (404) : les liens ouvrent le site sur iOS. |
| `ANDROID_CERT_SHA256` | `WHISHLIST_ANDROID_CERT_SHA256` | Pas de fichier Android (404) : les liens ouvrent le site sur Android. |
| `APP_STORE_URL` | `WHISHLIST_APP_STORE_URL` | Pas de badge App Store. |
| `PLAY_STORE_URL` | `WHISHLIST_PLAY_STORE_URL` | Pas de badge Google Play. Sans les deux adresses, pas d'icône. |

Chacune est ajoutée au tableau du `README.md`, à `.env.example` et à `deploy/compose.prod.yml` (AGENTS.md).
