# Revue de code

Revue de la PR 16 (clés d'API et serveur MCP), base `e4d5ec9`. Tous les points sont corrigés dans le commit qui ajoute ce fichier.

## Fichiers relus

```text
9b2eec81c57b4d199fa6a8e950be1104b83f895b  app/api/mcp/route.ts
e2046feb81c3979132a13e6e534685025033c94f  app/api/v1/auth/logout/route.ts
bd3a4e22674e89e9e0beadbfff24f0c99bde8825  app/api/v1/me/deletion/route.ts
c0182dcabc11270514766b32a4ec3304d7c0e8fa  app/api/v1/me/email-verification/route.ts
ceb5cb57ea5140400db1816a3e64bd02a175e8db  app/api/v1/me/email/route.ts
1dead4140c104938ce1c71c48ae1aab0e64f7222  app/api/v1/me/export/route.ts
aa2ef33996408532b36fbcc9df4daab7893c364d  app/api/v1/me/password/route.ts
373fe3611a14c5455597c68b90231739e4f6b742  app/compte/page.tsx
e0563b63b05a1f706adf36db6faaece0f4d64539  app/listes/[id]/page.tsx
cbc7ec98ce54f3cf252750ed572b2c6b70446966  components/site/api-keys-card.tsx
3384b7e4facfe6d0e7d80aa6b00e70bdca79fab8  drizzle/0005_api_keys.sql
66a35d35a38ae32cf1bb79edf73ce64866336917  locales/en/auth.json
9f494e65e272566cd65dd319c74d698f9bc41246  locales/en/errors.json
92fd58bfa92bd4e2376eed94e26f4986ec46abd9  locales/fr/auth.json
bf28db7b8d028d051afdb22e0bad7f5b39a5c74d  locales/fr/errors.json
8ed2d0e638502478ef0ebd088600bf9b1c73b95d  package.json
eb5234b90b7504c22d602155584f82fc16d0d630  specs/004-mobile-api/contracts/openapi.yaml
68f82b0201a20466af1a0a2165e7204bb1e87472  src/auth/api-key-limits.ts
91a321f0d7100d57e25476269fee312a34899662  src/auth/api-keys.ts
f39c6ce1a599a245d9a59cea24e98e55eb951742  src/auth/api-session.ts
8f135c279844aaac9d246e3a057b82900e66d92a  src/domain/account.ts
f8c6e3a29ff3242c6121b918117fe150ed7585d8  src/domain/password-reset.ts
6c9554c3367ecdbd031b390ee5b59858eb9c315c  src/domain/price.ts
b06fa0ffa4cdaa252e9a7ca64defb152fd12c2e7  src/domain/types.ts
e5209d4954efdbd176eae82bb53b98e49cf30d3e  src/domain/users.ts
68b906a6f2326c09d3ce2a7da0d8c9ee392fd8c7  src/server/actions.ts
12b21eeca20082398a3c8ea0b944d968ef18968b  src/server/api/auth.ts
e2ffc983f3814d7a8be616b706d6e775490414e3  src/server/api/errors.ts
ca516747ffe5e2f665ab0016e3f4da002ed7c57a  src/server/api/http.ts
41f25fca907444f67551f2f99e7477cca88e657f  src/server/commands/api-keys.ts
57af36d16b1a56c780300d33c985cd9fa44e6342  src/server/mcp/gate.ts
735349e45479332be186da6f4b4f113daad2d91e  src/server/mcp/server.ts
7b4f95168b5fde7e5667527dbb08592a8c212c13  src/store/legacy-json.ts
d49b81c20ba989b3361ea4ef0f1985635fafa54b  src/store/rows.ts
8fb75a7b4938f04674bf68386d96fc116f3e8afd  src/store/schema.ts
7f667508184495bd5716fcd39d990671df2cf9e9  tests/domain/account-export.test.ts
882ad03e15592b32dd72f7b192d6bf199ccd9307  tests/domain/api-keys.test.ts
cfc1c2af88f8cea68a7ef8baffec61405ab372d1  tests/domain/helpers/account-fixtures.ts
b8a00677e7898320dcd5519015d4be12bc57b42c  tests/domain/mcp-server.test.ts
6420a3633e8c742710ac4dd2ee386a0b3f28a353  tests/domain/store-import.test.ts
12110a3fa4b7fd0e320e221668397fd45ff5ce67  tests/domain/store-rows.test.ts
```

## Règles métier et tests

- [x] src/server/mcp/server.ts:269 — `rename_*` et `delete_*` visaient le premier libellé sur un nom blanc (`" "` passait `min(1)`). Corrigé : schéma `trim().min(1)`, et `target()` ne retombe plus sur le premier.
- [x] src/server/mcp/server.ts:189 — `update_idea` avec `category: ""` ou `for: ""` changeait l'idée de catégorie ou de « qui ». Corrigé : un blanc garde ceux de l'idée.
- [x] src/server/mcp/server.ts:113 — `get_list` rendait le prix localisé (`"19,90 €"`), refusé par `update_idea`. Corrigé : prix en euros, en nombre.
- [x] components/site/api-keys-card.tsx:25 — La clé « affichée une fois » restait visible après sa révocation, et l'avis `?k=revoked` restait dans l'adresse. Corrigé : la clé ne s'affiche que tant que sa ligne existe ; l'avis est retiré à la création suivante.
- [x] src/server/actions.ts:157 — `createApiKeyAction` plantait (500) sur une entrée forgée. Corrigé : nom normalisé.
- [x] app/api/mcp/route.ts:28 — La porte du serveur MCP n'avait aucun test. Corrigé : `src/server/mcp/gate.ts` (`mcpAccess`), testé dans `tests/domain/mcp-server.test.ts`.
- [x] src/server/mcp/server.ts:359 — `fill_from_url` sans test de réponse. Corrigé : non-membre (`listMissing`) et lien non web (`urlInvalid`).
- [x] src/server/commands/api-keys.ts:20 — Limite de 10 créations par heure ni documentée ni testée. Corrigé : README et test.
- [x] tests/domain/api-keys.test.ts:95 — Le test des 120 requêtes par minute passait avec un seau global. Corrigé : une seconde clé du compte reste utilisable.
- [x] tests/domain/store-import.test.ts:57 — Import legacy et aller-retour store sans `apiKeys`, migration 0005 non testée sur une base existante. Corrigé : défaut `[]`, deux clés dans `edgeDoc`, test de migration depuis 0000–0004.
- [x] src/domain/account.ts:123 — Export du compte muet sur les clés. Décidé : les accès (sessions, clés) n'en font pas partie ; documenté et testé (aucun `tokenHash` ni nom de clé).
- [x] README.md:237 — Pas de parcours manuel. Corrigé : `specs/013-api-keys-mcp/quickstart.md`.

## Constitution et sécurité

- [x] src/domain/users.ts:78 — Un changement volontaire du mot de passe laissait les clés actives. Corrigé : les clés du compte sont révoquées, comme au reset (README, contrat et texte de la page mis à jour).
- [x] src/server/mcp/server.ts:60 — Les exceptions internes partaient telles quelles au client MCP. Corrigé : journalisées, réponse `serverError` traduite.
- [x] app/api/mcp/route.ts:15 — Corps MCP jusqu'à 4 Mio et chaînes non bornées. Corrigé : 64 Kio comme l'API, bornes sur noms, titres, identifiants et URL.
- [x] src/auth/api-session.ts:16 — Un jeton de session pouvait commencer par `oys_`. Corrigé : retiré tant qu'il a le préfixe, générateur injectable pour le test.

## Duplication

- [x] app/api/v1/me/password/route.ts:10 — Garde recopié dans neuf handlers et test par regex. Corrigé : option `withApi(…, { refuseApiKey: true })`.
- [x] src/server/mcp/server.ts:40 — `pick()` refaisait `resolveTypeId`. Corrigé : réutilisé.
- [x] src/server/mcp/server.ts:47 — `priceInput()` refaisait `euros()` de la page liste. Corrigé : `priceInput` dans `src/domain/price.ts`, utilisé par les deux.
- [x] app/api/mcp/route.ts:29 — Vérification d'`Origin` refaite à la main. Corrigé : `originDecision`.
- [x] app/api/mcp/route.ts:17 — Refus d'une autre forme que l'API. Corrigé : `apiError`.
- [x] components/site/api-keys-card.tsx:86 — État vide en `<p>` nu. Corrigé : primitive `Empty`.
- [x] tests/domain/api-keys.test.ts:86 — `resetRateLimitsForTests()` répété alors que `withStore` le fait. Corrigé : retiré.

## Conventions

- [x] app/api/mcp/route.ts:15 — Cast `as CommandContext` sur `authInfo.extra`. Corrigé : le contexte passe par une fermeture.
- [x] src/server/commands/api-keys.ts:7 — Commande `myApiKeys` jamais appelée. Corrigé : retirée (la page lit le document, comme ses autres cartes).

## i18n

- [x] components/site/api-keys-card.tsx:122 — Le bouton de copie de l'adresse MCP disait « Copier la clé ». Corrigé : `apiKeys.copyMcpUrl`.
- [x] locales/fr/auth.json:141 — « Authorization : Bearer » déformait le littéral. Corrigé : « Authorization: Bearer » entre guillemets.
- [x] locales/fr/errors.json:89 — Apostrophes typographiques dans un fichier qui n'en a pas. Corrigé.
- [x] app/api/mcp/route.ts:30 — Refus HTTP en anglais écrit en dur. Corrigé : codes traduits selon `Accept-Language`.
- [x] app/api/mcp/route.ts:46 — Un client MCP n'envoie pas d'`Accept-Language` : refus en français. Corrigé : documenté dans le README (`--header "Accept-Language: en"`).
