# Contract Additions: API v1 (1.5.0) — Abonnements aux listes

**Feature**: `012-list-subscriptions` | **Contrat principal**: `specs/004-mobile-api/contracts/openapi.yaml`

## 1. `GET /lists` (étendu, rétrocompatible)

Retourne désormais les listes dont le compte est membre (`lists`) ainsi que les listes qu'il suit (`subscriptions`) :

```yaml
responses:
  "200":
    content:
      application/json:
        schema:
          type: object
          required: [lists, subscriptions]
          properties:
            lists:
              type: array
              items: { $ref: "#/components/schemas/ListSummary" }
            subscriptions:
              type: array
              items: { $ref: "#/components/schemas/SubscribedListSummary" }
```

## 2. `POST /subscriptions`

Abonne le compte connecté à une liste publique à partir de son lien ou de son `readToken`.

- **Auth** : `bearer` obligatoire (compte actif).
- **Headers optionnels** : `X-Read-Unlock` (si la liste protégée a déjà été déverrouillée par le client).
- **Request body** :
  ```yaml
  type: object
  required: [urlOrToken]
  properties:
    urlOrToken:
      type: string
      description: Lien public complet (`https://.../l/<readToken>`) ou `readToken` brut.
    password:
      type: string
      description: Mot de passe de lecture (si la liste est protégée).
  ```
- **Responses** :
  - `201` : Abonnement créé → `SubscribedListSummary`
  - `200` : Déjà abonné (idempotent) → `SubscribedListSummary`
  - `400` : `subscriptionLinkInvalid`, `alreadyMember`, `badPassword`
  - `401` / `403` : `unauthorized`, `mustChangePassword`
  - `404` : `listMissing`
  - `423` : `readPasswordRequired` (corps `{ error: { code: "readPasswordRequired", message: "..." }, title: string, readToken: string }`)
  - `429` : `rateLimited`

## 3. `DELETE /subscriptions/{readToken}`

Désabonne le compte connecté de la liste identifiée par `readToken`. Les réservations faites par ce compte sur cette liste sont conservées.

- **Auth** : `bearer` obligatoire.
- **Parameters** : `readToken` (in path).
- **Responses** :
  - `204` : Désabonné.
  - `401` / `403` : `unauthorized`, `mustChangePassword`
  - `404` : `listMissing` (aucun abonnement pour ce `readToken`).

## 4. `GET /public/lists/{readToken}` (enrichi)

- **Comportement** :
  - Si un bearer valide est fourni et que le compte suit cette liste avec un `readPasswordHash` à jour, l'accès est accordé sans exiger `X-Read-Unlock`.
  - Le schéma `PublicList` gagne le booléen `subscribed` (indique si le compte connecté suit cette liste) et `isMember` (indique s'il en est membre), permettant au client d'afficher l'état d'abonnement.

## 5. Nouveaux schémas

```yaml
SubscribedListSummary:
  type: object
  required: [id, readToken, title, subtitle, coverImageUrl, theme, itemCount, readUrl, subscribedAt, locked]
  properties:
    id: { type: string }
    readToken: { type: string }
    title: { type: string }
    subtitle: { type: [string, "null"] }
    coverImageUrl: { type: [string, "null"] }
    theme: { $ref: "#/components/schemas/Theme" }
    itemCount: { type: integer, description: 0 si `locked` vaut true. }
    readUrl: { type: string }
    subscribedAt: { type: string, format: date-time }
    locked:
      type: boolean
      description: true si un mot de passe de lecture a été ajouté ou modifié depuis l'abonnement.
```

Dans `AccountExport` :
- Ajout de `subscriptions` (tableau d'objets `{ title, subtitle, publicUrl, subscribedAt }`).
