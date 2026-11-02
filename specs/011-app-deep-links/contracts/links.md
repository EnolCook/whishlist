# Contrat : liens du site ouverts par l'app

Source unique : `APP_LINK_ROUTES` dans `src/site/app-links.ts` ([research R3](../research.md#r3-chemins-revendiqués--une-seule-table-partagée-par-le-site-et-lapp)). Chaque chemin existe aussi avec le préfixe `/en`. L'app ignore ce préfixe et affiche l'écran dans sa propre langue. La requête (`?…`) est conservée.

## Chemins revendiqués

| Chemin du site | Écran de l'app | Action |
| --- | --- | --- |
| `/confirmer-email/{token}` (`?suite=/inviter/{t}` possible) | `/links/confirm-email/{token}` | `POST /auth/email-confirmation` à l'ouverture, puis `refreshMe`. Suite : invitation si `suite` en porte une, sinon ses listes (connecté) ou la connexion. Après un changement d'adresse : « Mon compte ». |
| `/reinitialiser/{token}` | `/links/reset-password/{token}` | Formulaire du nouveau mot de passe (règles de `passwordPolicyError`), puis `POST /auth/password-reset/confirm` avec `signIn` = personne de connecté. |
| `/inviter/{token}` | `/links/invite/{token}` | Sans session : lien gardé (`pending`), puis connexion ou inscription, puis retour ici. Connecté : `GET /invitations/{token}` (titre), bouton « Rejoindre », `POST …/accept`, puis `/lists/{listId}`. Déjà membre : `/lists/{listId}` tout de suite. |
| `/connexion`, `/inscription` | `/login`, `/register` | Connecté : ses listes (`/`). `?next=/inviter/{t}` → le lien est gardé comme ci-dessus. |
| `/l/{readToken}` | `/guest/{readToken}` | Membre de la liste (copie locale) : `/lists/{listId}`. Sinon, vue invité. |
| `/l/{readToken}/reserver` (`?itemId=`, `?typeId=`) | `/guest/{readToken}/reserve` | « Je veux offrir », même choix d'idée ou de catégorie que le site. |
| `/l/{readToken}/types` | `/guest/{readToken}` (`?typeId=`) | La vue invité ouvre son filtre par catégorie. |

## Chemins non revendiqués (le site s'ouvre)

`/`, `/listes/*` (l'app ouvre exprès ces pages dans le navigateur : « Gérer le partage sur le site » ; revendiquées, elles rouvriraient l'app), `/guide`, `/faq`, `/projet`, `/mentions-legales`, `/donnees-personnelles`, `/compte` et `/compte/export`, `/mot-de-passe-oublie`, `/changer-mot-de-passe`, `/api/*`, `/u/*`, `/_next/*`, fichiers statiques.

`appPathForSiteUrl` rend `null` pour ces chemins, et `redirectSystemPath` rend alors `/`. Ce cas n'arrive pas avec un lien universel (le système ne les envoie pas à l'app). Il n'arrive que par le schéma `ohyoushouldnt://`.

## Formes d'adresse acceptées par `appPathForSiteUrl`

- `https://<hôte de l'API de l'app>/…` : un autre hôte → `null`.
- `ohyoushouldnt:///…` et `ohyoushouldnt://…` : l'hôte de l'adresse est le premier segment (`ohyoushouldnt://confirmer-email/abc`).
- Un chemin seul (`/confirmer-email/abc`), tel qu'expo-router le passe parfois.

Les jetons sont des segments opaques : ils sont décodés une fois, puis passés tels quels à l'API. Un segment vide ou qui contient `/` → `null`.

## Fichier Apple : `GET /.well-known/apple-app-site-association`

Avec `APPLE_TEAM_ID` réglé : `200`, `content-type: application/json`, sans redirection.

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["<APPLE_TEAM_ID>.app.ohyoushouldnt.mobile"],
        "components": [
          { "/": "/confirmer-email/*" }, { "/": "/en/confirmer-email/*" },
          { "/": "/reinitialiser/*" },   { "/": "/en/reinitialiser/*" },
          "… un objet par ligne de la table, avec et sans /en …"
        ]
      }
    ]
  }
}
```

Sans `APPLE_TEAM_ID` : `404`.

## Fichier Android : `GET /.well-known/assetlinks.json`

Avec `ANDROID_CERT_SHA256` réglé (empreintes séparées par des virgules, format `AA:BB:…`) : `200`, `content-type: application/json`.

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.ohyoushouldnt.mobile",
      "sha256_cert_fingerprints": ["<empreinte Play>", "<empreinte clé d'envoi>"]
    }
  }
]
```

Sans la variable : `404`. Les chemins ne figurent pas dans ce fichier. Ce sont les `intentFilters` de l'app (`pathPrefix` tirés de la table) qui les limitent.

## Côté app (`mobile/app.config.ts`)

Seulement si `EXPO_PUBLIC_API_URL` est en `https` :

- `ios.associatedDomains: ["applinks:<hôte>"]` ;
- `android.intentFilters` : une entrée `autoVerify: true`, `action: VIEW`, `category: [BROWSABLE, DEFAULT]`, `data` = `{ scheme: "https", host: <hôte>, pathPrefix }` pour chaque préfixe de la table, avec et sans `/en`.

La variante `development` (`app.ohyoushouldnt.mobile.dev`) ne déclare aucun domaine : elle n'est pas dans les fichiers d'association.
