# Vérification à la main : clés d'API et serveur MCP

Sur la base de démo (principe IV). Les comptes sont ceux de `npm run demo:data`.

```bash
npm run demo:data -- tmp/demo-wishlist.json
WISHLIST_DATA_PATH=tmp/demo-wishlist.json DEMO_PASSWORD=… PORT=3010 npm run dev
```

## 1. Créer, voir et révoquer une clé (site)

1. Se connecter, ouvrir **Mon compte**, section « Clés d'API et assistants IA ». Sans clé, l'état vide s'affiche.
2. Créer une clé « Claude » : elle s'affiche une fois, commence par `oys_`, avec « Copiez-la maintenant ». La copier.
3. Recharger la page : la clé n'est plus affichée ; la ligne montre le nom, les 4 derniers caractères, « jamais utilisée ».
4. Révoquer une clé juste après l'avoir créée : l'avis « La clé est révoquée » s'affiche, et la clé en clair a disparu. Créer une autre clé : l'avis disparaît.
5. Le bouton de copie de l'adresse MCP dit « Copier l'adresse ». À 390 px de large, pas de défilement horizontal.

## 2. Brancher un vrai assistant

```bash
claude mcp add --transport http ohyoushouldnt-dev http://localhost:3010/api/mcp \
  --header "Authorization: Bearer oys_…" --header "Accept-Language: en"
```

1. Demander à l'assistant « liste mes listes », puis « ajoute un coffret thé à 32,50 € dans la catégorie maison » : l'idée apparaît sur le site.
2. Demander de supprimer une idée réservée : l'assistant rapporte le refus, en anglais.
3. Demander de supprimer une catégorie : le client demande une confirmation avant l'outil (`destructiveHint`).
4. Sur la page Compte, la clé indique « utilisée le … ».

## 3. Révocation et accès refusés

1. Révoquer la clé pendant que la session de l'assistant est ouverte. Au message suivant, l'assistant rapporte un refus `401` ; rien n'est écrit.
2. Avec `curl`, sans en-tête, avec un jeton de session de l'app, ou avec une clé révoquée : `401` et `WWW-Authenticate: Bearer realm="mcp"`.
3. Avec `-H "Origin: https://autre.example.test"` : `403 originNotAllowed`.
4. Avec une clé, `GET /api/v1/lists` et `POST /api/v1/me/password` : `403 apiKeyNotAllowed` (une clé n'ouvre que `/api/mcp`).
5. Changer son mot de passe sur le site : la clé est révoquée (`401`).

## 4. Limite de débit

Envoyer 121 requêtes en moins d'une minute avec la même clé :

```bash
for i in $(seq 121); do curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer oys_…" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' http://localhost:3010/api/mcp; done | sort | uniq -c
```

Attendu : 120 réponses `200`, puis `429 rateLimited`. Une deuxième clé du même compte répond encore `200`.
