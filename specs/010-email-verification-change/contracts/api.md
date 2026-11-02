# Contrat : changements de l'API (1.2.0 → 1.3.0)

Ces changements sont à reporter dans `specs/004-mobile-api/contracts/openapi.yaml`, qui reste la seule source du contrat. Ensuite, `npm --prefix mobile run api:types` régénère les types de l'app. `tests/domain/api-contract.test.ts` vérifie que chaque nouvelle opération a sa route.

Note de version à ajouter dans `info.description` :

> 1.3.0 : validation de l'adresse e-mail et changement d'adresse. `Me` gagne `emailVerified` et `pendingEmail`. Nouvelles opérations `POST /me/email-verification`, `POST /me/email` et `DELETE /me/email`. `emailNotVerified` (403) sur `POST /lists`, `POST /lists/{listId}/invitations` et `POST /invitations/{inviteToken}/accept`.

Tous les changements sont compatibles avec les clients existants : des champs de réponse en plus, des opérations en plus et un code d'erreur en plus.

## Schéma `Me`

```yaml
Me:
  type: object
  required: [id, email, displayName, mustChangePassword, emailVerified, pendingEmail]
  properties:
    id: { type: string }
    email: { type: string }
    displayName: { type: string }
    mustChangePassword: { type: boolean }
    emailVerified:
      type: boolean
      description: Faux seulement si la validation est exigée (envoi d'e-mail actif) et l'adresse pas encore confirmée. Depuis 1.3.0.
    pendingEmail:
      type: [string, "null"]
      description: Nouvelle adresse en attente de confirmation. Depuis 1.3.0.
```

`Session.user` étant un `Me`, `/auth/login`, `/auth/register` et `/me/password` rendent aussi ces champs.

## `POST /me/email-verification`

Renvoie le lien de confirmation de l'adresse actuelle. Le lien précédent cesse de valoir.

- Corps : aucun.
- `202` : `{ sent: boolean }`. `sent` est faux si l'envoi a échoué : réessayer plus tard.
- `409 emailAlreadyVerified` : adresse déjà vérifiée, ou validation non exigée.
- `403 mustChangePassword`, `401`, `429` (5 par heure et par compte).

## `POST /me/email`

Demande un changement d'adresse.

- Corps : `{ email: string, currentPassword: string }`.
- `200` : `Me`. Avec l'envoi actif, `email` ne change pas encore et `pendingEmail` vaut la nouvelle adresse (un lien est parti vers elle). Sans envoi, `email` vaut la nouvelle adresse et `pendingEmail` vaut `null`.
- `400` : `emailInvalid`, `emailUnchanged` ou `wrongCurrentPassword` ; `emailTaken` seulement sans envoi d'e-mail. Avec l'envoi actif, l'adresse d'un autre compte reçoit la même réponse `200` qu'une adresse libre (aucun e-mail ne part, la confirmation est impossible).
- `403 mustChangePassword`, `401`, `429` (5 par heure et par compte).

## `DELETE /me/email`

Annule le changement en attente. Sans demande en attente, ne fait rien.

- `200` : `Me`, avec `pendingEmail: null`.
- `403 mustChangePassword`, `401`.

## Refus `emailNotVerified`

Ajout d'une réponse `"403": { $ref: "#/components/responses/Error" }` (code `emailNotVerified`), si elle n'y est pas déjà, sur :

- `POST /lists`
- `POST /lists/{listId}/invitations`
- `POST /invitations/{inviteToken}/accept`

## Ce qui ne passe pas par l'API

La confirmation elle-même (`/confirmer-email/<token>`) est une page du site : le lien reçu par e-mail ouvre le site, comme la réinitialisation du mot de passe.

## Pages et actions du site

| Chemin | Rôle |
| --- | --- |
| `/confirmer-email/[token]?suite=<chemin>` | Affiche la demande (adresse masquée si la personne n'est pas connectée à ce compte) et un bouton « Confirmer ». Si le lien est invalide ou expiré, affiche l'erreur, avec « Renvoyer le lien » pour un compte connecté non vérifié. Après confirmation : « Reprendre l'invitation » (si `suite` commence par `/inviter/`), sinon « Mes listes », ou la connexion pour une personne non connectée. |
| `/inscription?ok=1` | Gagne le message « Consultez votre boîte » quand la validation est exigée, avec en dev le lien (`lien=`), jamais en production. |
| `/compte` | Nouvelle carte « Adresse e-mail » : adresse actuelle et son état, changement en attente avec bouton « Annuler », formulaire nouvelle adresse et mot de passe actuel. |
| bandeau (layout) | « Confirmez votre adresse » avec « Renvoyer le lien ». |

Server actions ajoutées à `src/server/actions.ts` : `resendEmailVerificationAction`, `requestEmailChangeAction`, `cancelEmailChangeAction` et `confirmEmailAction`.
