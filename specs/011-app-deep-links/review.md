# Revue de code

Revue complète du 2026-11-02, depuis `686fe13` (fin de la 010, pas encore sur `origin/main`). Tous les points corrigés le même jour ; `npm run lint`, `typecheck` et `test` verts (site 278, app 214).

## Fichiers relus

```text
73c1a84f7eaadcbf801f534ef9f56916aecd78d7  .env.example
26b24495e1d8f56532be913df88360bb66b22a41  app/.well-known/apple-app-site-association/route.ts
f2bf444d2d61e571ec95fc20fe7f37036a5b7cf6  app/.well-known/assetlinks.json/route.ts
8168198a9aaf223749167a6825385146485f4609  app/api/v1/auth/email-confirmation/route.ts
931829541c89697ae76029de5d8fc0744665917b  app/api/v1/auth/password-reset/confirm/route.ts
863c50c98ab7e0435cd1f112578cc17fcb63ec0b  app/api/v1/capabilities/route.ts
da129ba393b6a8f3835e41230a77139f00632cdc  app/api/v1/invitations/[inviteToken]/route.ts
17347fe9758551b7f915c690ade930815b8cdb16  app/globals.css
66ed89977a5a1333c23b3fb2f50f30e41ad27951  app/inviter/[token]/page.tsx
570e6bdca47e0c379b6a8b2df2aa8f98e272ef1c  app/layout.tsx
21dcf81a3d53cc86d4db5e8e9c15fc1093ed3fa9  app/reinitialiser/[token]/page.tsx
e8753bec9889f0f465c34d65485eecc456c04908  components/site/get-app-button.tsx
9fd162c890c36c0326ec5946c992fdfa358186ea  deploy/compose.prod.yml
1cfe72caa408802dd88c0381d6cbe835c37456d4  locales/en/common.json
9cdc1c4df428ab8a5d8424d68c7eb6dd2bc3d619  locales/en/mobile.json
4c73a9beea36008d72e49469fb0f95993ba5f365  locales/fr/common.json
d3247151e605e54d8a51b0a89d694f2c699c978a  locales/fr/mobile.json
a6db24f44d9112fd4d4ba939328d67a5ccf8111a  mobile/__tests__/auth/session.test.ts
066885ff620bc3349819c81764f99e94565aab62  mobile/__tests__/e2e/coverage.test.ts
41bf2180f60ff3cebb57a7bd6b4d4b14ff06e84e  mobile/__tests__/features/guest-storage.test.ts
73ee6d230681b54abde2aa9ae39d95f6ccfbecb4  mobile/__tests__/helpers/public-list.ts
cecb16f5566bde2e85c46d13df5c38d3cda73f6a  mobile/__tests__/links/app-config.test.ts
fa806f2f1b522421e72947aa02de779b70167a0e  mobile/__tests__/links/native-intent.test.ts
65e2eb57988882ec9e437e1e4c4512b30f358017  mobile/__tests__/links/pending.test.tsx
1924dce9abb4e95180ff0f73f5f9adc0bab9320e  mobile/__tests__/screens/guest-list.test.tsx
61eb9075ed0968770f17713720d1f69dbbecae9a  mobile/__tests__/screens/guest-reserve.test.tsx
af2fc50165d586803a50c2d3487b1bcac5ca63a7  mobile/__tests__/screens/links-confirm-email.test.tsx
8c8a6b6a0e1a07a21648f75ade627315763c31eb  mobile/__tests__/screens/links-invite.test.tsx
81cba52cb54336d40a32ca6ae6ac48795906c92c  mobile/__tests__/screens/links-reset-password.test.tsx
dfc77f4d6cc3056f96986d3c2cbe723c75d47324  mobile/__tests__/screens/login.test.tsx
1192ea10faecbf1f830e1c0adc5d15aed6bec68d  mobile/__tests__/screens/share.test.tsx
3962b2b1987a346859c1cf5d183e95ca2fc3b6d4  mobile/.maestro/flows/011-us1-email-links.yaml
97f0b752770d61efcbb13383718ac00bd27a442d  mobile/.maestro/flows/011-us2-invite-link.yaml
54830bf7980edd1c2b72532053748c7d6fa4dd84  mobile/.maestro/flows/011-us4-guest-list.yaml
df01f6dcb25d674c8a97db299a6559507e011bfe  mobile/.maestro/scripts/app-link.js
c23729710de0212a3716d768a725204c31730b1d  mobile/.maestro/scripts/maildev-link.js
8ad88e5ccd02d7ed338131583bf4b79710548afd  mobile/.maestro/subflows/open-mail-link.yaml
0b542424c745dbedf63586bfe0eca02d02f64392  mobile/app.config.ts
1a0c985df1072da6392f4d0494070b664db8fc7e  mobile/app/(auth)/_layout.tsx
04ae44fb92a2f9348562d6feccaa99b94aa56dde  mobile/app/(auth)/login.tsx
75e51f1f0451968ad2ef568a59defa2549fba201  mobile/app/(auth)/register.tsx
e921111f1555ce4de1138667923ed9f88cd8927c  mobile/app/+native-intent.tsx
b4418010e184e6ff453f90e2c200be2c29fda7bd  mobile/app/change-password.tsx
7d21ae4bf7b10d7f817e0083db4b2d1da1ca072a  mobile/app/guest/[readToken]/index.tsx
b62b768cf0aa61d700dd87912b5ba1e863b86fb8  mobile/app/guest/[readToken]/reserve.tsx
ab34c6fae82e2a036bf6bd8896963c953164b1b7  mobile/app/links/confirm-email/[token].tsx
7348af6416d264fe0e78259a07a75f62c14f43e4  mobile/app/links/invite/[token].tsx
7dba1339c141f66e6d2eebea50450127cd1dd14a  mobile/app/links/reset-password/[token].tsx
6c546b2805ef59798224211640f6ea00010d2da7  mobile/src/auth/session.ts
3a7e4a59c3be099a5834a2ca0837d3ae2756bdb4  mobile/src/features/guest/api.ts
cb78d54396e16cf536323ec0425ef59469fcaafc  mobile/src/features/guest/GuestItemCard.tsx
ff86b51f0de32dabd15f03a129d81c840377c543  mobile/src/features/guest/GuestListHeader.tsx
e71774dc734f53abac4e31957686ba834964f3e3  mobile/src/features/guest/storage.ts
66141a3341bf795a0c9519c3f9d358d7aee9ed61  mobile/src/features/guest/useGuestList.ts
a434ed4886052f88792c6c9ed4de7c533b516a20  mobile/src/features/lists/ListScreen.tsx
0ae9b8fac39bca269babb4ca09faf2ffa1d72481  mobile/src/links/pending.ts
052de87036c016f2488222be0cab447aa204f8a0  mobile/src/links/routes.ts
dbcb65dfd827a265e31942542a74c78962a24f0e  proxy.ts
9a01e00fc2b5ae4f7b7cf10e4fc78a03f6f160b0  specs/004-mobile-api/contracts/openapi.yaml
34573a4a3775d03f52b21ffc021db13b0b1088df  src/domain/membership.ts
c0bde3bd49bf513645141c99ef7eb5855758994a  src/server/actions.ts
76871ccdac8a6b698f498a9f306f2ad5cf62e9d1  src/server/api/http.ts
9716061aca73c65d149fc82b214d4517b6f0135f  src/server/commands/auth.ts
e250aa8446e4462e358070c3dccc67e1c5ac4e03  src/server/commands/sharing.ts
850c5711dd88c4fbdbfafcdb628c3fd8eb071ac2  src/site/app-link-routes.json
68ead794c7edfa11b13ed26fb7d53e7f1b65df47  src/site/app-links-config.ts
18efe492c10d9da759a3834b8e5771b7c80c384c  src/site/app-links.ts
e1b4ed9a22c7b62c6ee3d8f8a980bc97bcc1b6a2  src/site/device.ts
a1dc42dcd474c358d1c5009795c985ae86dd865c  src/site/links.ts
c73054d6faa2a6a3e08711d752a624e0611d2842  tests/domain/api-http.test.ts
6d745cc33bd47d3f0e0994af05f1f5123ba4a1b0  tests/domain/app-links.test.ts
23d4981c554e97292fcded54a6b9f1bcc9336430  tests/domain/commands-auth.test.ts
46df53adeea25e415c21a829cc2c42de0c36536b  tests/domain/commands-email.test.ts
2714a177f3c8639fc05a60e8bfa8ea22ba6bcdcd  tests/domain/commands-sharing.test.ts
39d66313d2c1fac0cc68ac1cb988100b4cc7dd33  tests/domain/device.test.ts
```

## Règles métier et tests

- [x] mobile/app.config.ts:6 — `app.config.ts` importait `../src/site/app-links.ts`, que le chargeur de config d'Expo ne sait pas lire : `expo config`, `expo run` et les builds EAS échouaient (jest compile le TypeScript, donc les tests ne le voyaient pas). Trouvé en dehors des agents, en lançant `eas build:list`. Correction : table dans `src/site/app-link-routes.json`, et un test qui lance le vrai chargeur (commit `b143106`).
- [x] components/site/get-app-button.tsx:41 — L'état `ringing` vit dans le layout racine, qui reste monté d'une navigation à l'autre : l'icône ne s'anime qu'au premier chargement, pas « à chaque page affichée » (US3-1, Assumptions, FR-012). Correction : remonter l'animation à chaque changement de page (`key={pathname}` via `usePathname`).
- [x] mobile/app/guest/[readToken]/index.tsx:43 — La lecture publique part en même temps que la recherche du membre, alors que T050 et R9 demandent de reconnaître le membre « avant tout appel » (US4-3) ; un membre voit la vue invité passer avant la redirection. Correction : un état « checking » avant `useGuestList` quand une session est ouverte.
- [x] mobile/app/links/confirm-email/[token].tsx:69 — Sans session, un lien expiré n'affiche que le message et « Se connecter » ; le site ajoute `confirmEmail.loginToResend` (US1-6, FR-005). Correction : afficher ce texte sous l'erreur quand personne n'est connecté.
- [x] specs/011-app-deep-links/data-model.md:70 — « `401 readPasswordRequired` » alors que l'API répond `423` (repris par T046). Correction : écrire `423` dans data-model.md et tasks.md.
- [x] tests/domain/api-http.test.ts:51 — T011 et T023 cochés, mais `ownAccount: true` avec un bearer n'est testé nulle part, ni le `200` / `401` de `GET /invitations/{inviteToken}`. Correction : `confirmEmailWithToken(ctx(user), …)` dans `tests/domain/commands-email.test.ts`, et les cas de T011 et T023.
- [x] tests/domain/app-links.test.ts:121 — `cache-control` n'est jamais vérifié, ni le `content-type` du fichier Android (T004). Correction : vérifier ces deux en-têtes dans les deux tests.
- [x] mobile/__tests__/screens/links-confirm-email.test.tsx:52 — US1-8 (connecté à un autre compte que celui du lien) sans test : un `change` avec `ownAccount: false` ne doit pas proposer « Mon compte ». Correction : ajouter ce cas.
- [x] mobile/app/change-password.tsx:15 — « Changement de mot de passe imposé, puis l'app reprend le lien » (T007, R5) sans test. Correction : l'ajouter dans `mobile/__tests__/links/pending.test.tsx`.
- [x] mobile/src/features/guest/api.ts:27 — « Jeton de déverrouillage supprimé sur `readPasswordRequired` » (T046, US4-4) sans test. Correction : un cas avec un jeton gardé, puis 423, dans `guest-list.test.tsx`.
- [x] mobile/__tests__/screens/guest-reserve.test.tsx:38 — US4-2 (connecté, non membre) sans test : vue invité sans redirection et réservation envoyée avec le bearer. Correction : ajouter ce cas.
- [x] mobile/__tests__/auth/session.test.ts:75 — T048 : `deleteAccount()` doit aussi effacer l'accès invité, seul `signOut()` est vérifié. Correction : ajouter un test de `deleteAccount`.

## Constitution et sécurité

- [x] mobile/app/guest/[readToken]/index.tsx:262 — « Voir le site » appelle `Linking.openURL(item.url)` sans contrôler le schéma ; `item.url` vient du propriétaire de la liste, et l'import ne l'oblige pas à être `http(s)` (`src/domain/import.ts:44`) : une idée importée peut ouvrir `tel:`, `intent:` ou `ohyoushouldnt://` sur le téléphone de l'invité. Correction : n'afficher le bouton que pour `http://` ou `https://`, et valider l'URL à l'import. Corrigé dans l'app (`GuestItemCard`, test « seul un lien web s'ouvre »). Non corrigé pour l'import : `importTemplate` ne lit que le modèle versionné dans le dépôt, pas une donnée tierce, et la saisie et l'API exigent déjà `http(s)`.
- [x] app/api/v1/invitations/[inviteToken]/route.ts:9 — Le jeton d'invitation est dans le chemin, et `withApi` journalise `req.nextUrl.pathname` sur une erreur inattendue (`src/server/api/http.ts:168`) : le jeton peut finir dans les journaux (FR-009). Correction : masquer les segments de jeton dans le chemin journalisé par `withApi`.

## Duplication

- [x] src/site/app-links.ts:49 — `stripLocale` refait `stripLocalePrefix`, et les tests de chemin refont `internalPath` (`src/i18n/locale-path.ts`, module pur déjà repris par l'app). Correction : les réutiliser.
- [x] src/server/commands/sharing.ts:122 — `previewInvite` cherche la liste par `inviteToken` à la main, comme `acceptInvite` (`src/domain/membership.ts:81`). Correction : une fonction pure `findWishlistByInvite(doc, token)` dans `src/domain/membership.ts`, appelée par les deux.
- [x] mobile/src/features/guest/useGuestList.ts:48 — `memberListIdFor` analyse `readUrl` à la main. Correction : comparer `appPathForUrl(list.readUrl)` à `/guest/<readToken>`.
- [x] tests/domain/app-links.test.ts:16 — Sauvegarde et remise de `process.env` à la main. Correction : `withEnv` de `tests/domain/helpers/env.ts`.
- [x] tests/domain/device.test.ts:35 — Idem pour `APP_STORE_URL` et `PLAY_STORE_URL`. Correction : `withEnv`.

## Conventions

- [x] mobile/app/guest/[readToken]/index.tsx:221 — La carte d'une idée pose `backgroundColor`, `padding` et `gap` sur `Shadow` dans l'écran (« un écran n'écrit aucun style en dur »). Correction : un composant de carte d'idée dans `mobile/src/ui/`, ou `Card`. Corrigé : `mobile/src/features/guest/GuestItemCard.tsx` compose `Card` (et `GuestListHeader.tsx` pour l'en-tête), comme `ItemCard` pour la vue membre.
- [x] mobile/app/guest/[readToken]/index.tsx:262 — `item.url as string` fait taire le compilateur. Correction : une constante rétrécie avant le JSX.
- [x] mobile/app/guest/[readToken]/index.tsx:156 — `initialType!` fait taire le compilateur. Correction : `categories.find(...)?.id ?? ALL`.
- [x] src/site/app-links.ts:128 — `query.get(key) as string` après un `filter`. Correction : un seul passage (`flatMap`).

## i18n

Aucun point.
