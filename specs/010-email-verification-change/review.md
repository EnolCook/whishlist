# Revue de code

## Fichiers relus

```text
b53465ba4d6944aa9737dbfd2d09e4d8790b3118  .env.example
492e4d8690584c2782431c1c2650f1f4b43ed1e0  app/api/v1/capabilities/route.ts
42b25bed55e5e2b26f92b44c86b3e27e5b03342e  app/api/v1/me/email-verification/route.ts
1d193af12afeaf17c898163c308583152de9aa51  app/api/v1/me/email/route.ts
ea8c96cbfcfec975901fbe5cbdb092defd106873  app/api/v1/me/route.ts
4b380b98fc2a6d8ab69d1dbda93dfc13d71d2a45  app/compte/page.tsx
61f47c82ef8712112427b026776857599d940348  app/confirmer-email/[token]/page.tsx
43a82c8f89daf2dcec9a92841fb3489a9c60f4de  app/confirmer-email/layout.tsx
28d658411fb5d757229e5934236f09a7816b8f67  app/inscription/page.tsx
aad09451e2e8536ded5fe3d7694228eed7da220d  app/layout.tsx
7a4073376303df687398cb154c3eacc75b2c3a17  app/mot-de-passe-oublie/page.tsx
20531826321488bdbe21db62775676d06936b198  components/site/analytics-opt-out.tsx
bd66b36d7b74fe3731e9b7bd6238ac282f1eff2e  components/site/dev-link-alert.tsx
1f51968894dc73f4fd13b390ac7f48a5ed3bfe2d  components/site/email-verification-banner.tsx
3c52dd161f223f3b9d9b8556f8f6931f844b04cd  drizzle/0001_email_confirmations.sql
5518c3859ae8c2d1bdc8340640f37f15e23621de  locales/en/auth.json
f5e44a304d1cf00e4368e7c8ade5715705157d87  locales/en/content.json
e02ee778e93969608705f7c881e035c539f3cc39  locales/en/errors.json
18cc3e0a84e74bf41e821b25bf03bd92fb7cfb78  locales/en/mail.json
10e0b1cddace8b10d30f9f66b88647443acc62e6  locales/fr/auth.json
1cde6a9866a7f218dd99212e12ab213d8016ee03  locales/fr/content.json
1403b5dcf2a91cf4a09010b0bd896b973ff9415a  locales/fr/errors.json
fac1d84a732ed40cfa905ada78e5b48e02e99d4f  locales/fr/mail.json
c3808e486231c8c5c8d5af9250b94dfbeb6690b9  mobile/.maestro/flows/010-us3-change-email.yaml
e44c6783a84fc205554e7aa9e39e766ef0a38de5  mobile/__tests__/auth/session.test.ts
7f0d697b4fe74f324321bf0ed76678f74627c519  mobile/__tests__/e2e/coverage.test.ts
64144a502bc6da88d9cf96bbe43b3674a2e857f5  mobile/__tests__/helpers/fetch.ts
219ef7a56af867165d4b8cb2d5b3f2e50d9fc40a  mobile/__tests__/screens/account.test.tsx
445284d86ce143747f26fec31dabf69726b4c6c9  mobile/__tests__/screens/lists.test.tsx
f9f3b46c350f7ba9820700d0f5a611ae3beb9c3b  mobile/app/(app)/account.tsx
c9b85604d9d85e5db152c92274a0254cf955fa40  mobile/app/(app)/index.tsx
618a46f8fe731b35d15f1dd9e49c32df5c58990d  mobile/src/auth/session.ts
ba1223016dcda23b54df868deb76950e5407de1e  mobile/src/features/account/EmailCard.tsx
7e7196fa1563ac0d170d8153476129777e43be58  mobile/src/features/account/VerificationBanner.tsx
79e744c196b3428248fb049d8491a51989bfc19f  scripts/create-demo-data.mjs
6c201306424a7fe9c41c45be9117bd6b65f48b47  specs/004-mobile-api/contracts/openapi.yaml
44fbb2c0eb996cbeda5ed2edcca097e99f996ada  src/domain/account.ts
0baa4a4e81c90dfd1f30af2a835f2d76a8dab0d2  src/domain/email-confirmation.ts
6ccb47fa1a08aeb65cc78fcec902a00e32aa2729  src/domain/password-reset.ts
7db8f8e63e84b211e65b599c97cd854150606d57  src/domain/types.ts
37d57cf9936246ecebee84a1c7642586178ba363  src/domain/users.ts
cd225c33c5e663cb4dbcb7640197200f634cc68c  src/i18n/locale-path.ts
f1bd59f5444979a434e003e823fd407e081eaa2e  src/server/actions.ts
8de63c36ef0683bd4dca4e1b1ba335cb5847319c  src/server/api/errors.ts
f40cf483d1313f1b279a7c53402bf53625aaa143  src/server/api/views.ts
3de9c3c3bd4d131852c37554819de3429eef6fe2  src/server/commands/auth.ts
2b7ff0436f13d3728d536b573eadea8a870a29c5  src/server/commands/context.ts
7082a00fe950409cac65d70ce4a9eef11aba219e  src/server/commands/email.ts
aa4d2cea14a1f23d99dae09d971e823afdea6ed8  src/server/commands/lists.ts
a4e6a82e0e90d705c5a8062ef858b87813d1642f  src/server/commands/sharing.ts
b2eb5e79406bf9baefc38ad704213fe7205f7ebf  src/server/mail.ts
a55bebe769eb0a0b905703dc3393109746573ad7  src/site/analytics-public.ts
40fced18501e8ae7db127847991ce4642662c746  src/site/dev-link.ts
a8c50cfde52fc306ce11c923c512a91b72c04267  src/site/seo.ts
1873d125906f2358d2ddbb2721622b7c4f50c68e  src/store/legacy-json.ts
41fd93b0e4cd9ec8c813f275411412b5a8bc2310  src/store/rows.ts
fbb4f6e9207228ceb51d29bceeb1efec8e29a270  src/store/schema.ts
3069c7dd5663daeed66a3c52ff10e60a89408092  tests/domain/account-deletion.test.ts
2e10454ecbbe26bce572286e24a401616836ba94  tests/domain/account-export.test.ts
1615df9cda25aef95f5bb9c0be0237345f55b975  tests/domain/accounts.test.ts
a14460f16017ffdbb205888423ac7b3608448da6  tests/domain/analytics.test.ts
3173327b42e842c862a38b282d25625fa3b4a5ec  tests/domain/api-http.test.ts
f1a9a7cc6b13223be53629a6ef82a132116202eb  tests/domain/commands-auth.test.ts
a8e02efe6b4ad307fd8b208e20bf12c2cb02acaa  tests/domain/commands-email.test.ts
bfc422dfb1ebddb584c5e7b3748d8e59622ca2ef  tests/domain/commands-sharing.test.ts
28f060d9caa9e6e71608d264bada91e2512077f0  tests/domain/demo-seed.test.ts
b9479d4c59a3000ea9f0bd33664984bc15adbd53  tests/domain/dev-link.test.ts
5d59fa95952b9d3fe84bbf975988f1274d68fb41  tests/domain/email-confirmation.test.ts
807ad56309f2bd912a0029afed2d648c3191a15a  tests/domain/filters.test.ts
c57e06495ea21d80e9b3796ff5d62d53ed6cfa21  tests/domain/helpers/api-fixtures.ts
b31986e77e6767c07e65cef0c631435dd6aa91a4  tests/domain/helpers/env.ts
e625fba3ac84d350dd7e08a55bdce72ec54c66ab  tests/domain/import.test.ts
f47ad38cbaea16270eb3b3405104f1881d7f3b4a  tests/domain/items.test.ts
308da0dc83d99fea2d107ff9bc21e8f2b661b6cd  tests/domain/locale-path.test.ts
067aff60e3b646beac69c87c28f6ef38c7459d66  tests/domain/mail-config.test.ts
03d6b092d9abd27560e0791456a10111377ab8a9  tests/domain/membership.test.ts
c54718490c0a5677d4362f6c063b41bc0d35b2c9  tests/domain/password-reset.test.ts
d5de20448011007934cdfb88f8fa5ad218b28980  tests/domain/reorder-types.test.ts
5cfb7b41ac37515f6ac38c267e35d9a743bb2f68  tests/domain/store-import.test.ts
ec8adb31f5e38b7cfa142925f8d2b522aff271b3  tests/domain/store-rows.test.ts
```

## Règles métier et tests

- [x] app/inscription/page.tsx:57 — Si l'envoi échoue (Resend indisponible), la page affiche quand même `register.sentVerify` (« le lien que nous venons de vous envoyer ») : `register` perd le `sent` de `sendVerificationLink`, si bien que le cas limite « Échec d'envoi » n'est pas couvert. Correction : faire rendre `sent` par `register`, ajouter `&verify=failed` à la redirection et afficher `verifyBanner.failed` sur la page d'inscription.
- [x] locales/fr/mail.json:41 (et en) — L'avis à l'ancienne adresse conseille de réinitialiser le mot de passe « avec la nouvelle adresse », que la victime ne contrôle pas : le recours de FR-014 ne tient donc pas. Correction : retirer ce conseil et le lien « Mot de passe oublié », et ne garder que le contact `{{contact}}`.
- [x] app/compte/page.tsx:144 — La carte « Adresse de connexion » n'affiche pas l'état de l'adresse (vérifiée ou à confirmer), demandé par T045 et contracts/api.md. Correction : ajouter un libellé d'après `user.emailVerifiedAt` quand la validation est exigée.
- [x] app/confirmer-email/[token]/page.tsx:68 — Lien invalide ou expiré ouvert sans être connecté : rien ne propose d'en demander un nouveau après connexion (scénario US1-8). Correction : quand `user` est nul, afficher un `LinkButton` vers `/connexion`, avec un texte qui explique de renvoyer le lien une fois connecté.
- [x] app/confirmer-email/[token]/page.tsx:40 — Après un changement réussi, la page n'affiche pas la nouvelle adresse, alors que T046 demande « Votre adresse de connexion est maintenant … ». Correction : passer l'adresse (masquée) dans la redirection de `confirmEmailAction` et l'interpoler dans le texte. Corrigé autrement : l’adresse vient de la session (compte confirmé connecté), jamais de l’URL, sinon texte générique.
- [x] mobile/app/(app)/index.tsx:30 (et :47) — `lists.new` est désactivé, mais aucun texte `emailNotVerified` n'apparaît dessous, contrairement à ce que demande T026. Correction : afficher `errors:emailNotVerified` sous le bouton quand `unverified` est vrai, ou reformuler T026 (le bandeau suffit).
- [x] src/server/mail.ts:197 — Aucun test ne vérifie que les URL des tags `email-verification` et `email-change` sont masquées dans `mail.log` en production (FR-017). Correction : ajouter ce test dans tests/domain/mail-config.test.ts.
- [x] tests/domain/commands-email.test.ts:38 — Aucun test ne vérifie qu'un compte non vérifié peut encore réserver sur une liste partagée (scénario US1-7, FR-005). Correction : ajouter une réservation par la commande publique, avec `withMailDryRun` et `emailVerifiedAt: null`.
- [x] tests/domain/commands-email.test.ts:54 — Les tests « la garde laisse passer » et « sans validation exigée » ne vérifient pas `sendInvite` (T012). Correction : ajouter un `sendInvite` qui réussit dans ces deux tests.
- [x] src/server/commands/email.ts:90 — La limite `confirm-email` (20 par IP en 15 minutes, R13) n'a pas de test. Correction : vérifier que la 21ᵉ confirmation est rejetée par `isRateLimitError`, dans tests/domain/commands-email.test.ts.
- [x] tests/domain/api-http.test.ts:12 — T021 demande que `POST /lists` réponde 403 `emailNotVerified` pour un compte non vérifié, mais seule la table code → statut est testée. Correction : ajouter un appel de la route avec `MAIL_DRY_RUN=1` et un compte non vérifié.
- [x] src/store/legacy-json.ts:238 — Le refus d'un ancien JSON qui contient deux demandes du même motif pour un compte n'est pas testé. Correction : ajouter ce cas au test « refus : chaque contrôle d'intégrité… » de tests/domain/store-import.test.ts.

## Constitution et sécurité

- [x] src/site/analytics-public.ts:7 — `/confirmer-email` manque à `PRIVATE_PREFIXES` : avec Umami configuré, l'URL de la page part vers la mesure d'audience, jeton compris. Correction : ajouter `"/confirmer-email"` à cette liste, avec un cas de test.
- [x] components/site/email-verification-banner.tsx:43 — Le bandeau affiche en lien n'importe quel paramètre `lien` en `http…`, même en production : `/?verify=sent&lien=https://evil.example` montre un faux « lien de confirmation ». Correction : n'afficher ce lien qu'hors production et seulement s'il pointe vers `<origine>/…/confirmer-email/`.
- [x] src/domain/password-reset.ts:61 — Une réinitialisation du mot de passe laisse valable une demande `change` en attente : quelqu'un qui connaissait l'ancien mot de passe peut encore prendre l'adresse de connexion du compte après sa reprise. Correction : supprimer toutes les `emailConfirmations` du compte dans `resetPasswordWithToken` et `changePassword`, avec un test.
- [x] src/domain/email-confirmation.ts:75 — `requestEmailChange` répond `emailTaken` : un compte connecté peut ainsi tester si une adresse est inscrite, ce que `register` évite. Correction : rendre la même réponse que pour une adresse libre et refuser à la confirmation, ou acter cette fuite dans la spec (le scénario US3-4 demande aujourd'hui ce refus). Corrigé : même réponse qu'une adresse libre, sans e-mail ; refus seulement sans envoi d'e-mail ; spec (US3-4b, FR-010) et contrat mis à jour.

## Duplication

- [x] src/server/commands/email.ts:24 — `internalPath` reproduit `nextPath` (src/server/actions.ts:83) et le contrôle de src/site/seo.ts:28. Correction : une seule fonction pure, que `nextPath`, la commande et la page importent.
- [x] src/server/mail.ts:136 — `sendEmailVerificationMail` et `sendEmailChangeMail` recopient le gabarit de `sendPasswordResetMail`. Correction : un helper `sendLinkMail({ to, url, prefix, logTag, locale })`.
- [x] app/compte/page.tsx:150 — Le bloc `Alert` du lien de dev, avec son filtre de production, est copié dans app/inscription/page.tsx, dans le bandeau et dans app/mot-de-passe-oublie/page.tsx. Correction : un composant `components/site/dev-link-alert.tsx`.
- [x] src/domain/email-confirmation.ts:72 — `requestEmailChange` refait la validation de `setUserEmail` (src/domain/users.ts:87-91). Correction : une fonction `validateNewEmail(doc, userId, email)` dans src/domain/users.ts, que les deux appellent.
- [x] tests/domain/mail-config.test.ts:5 — `withEnv` fait en plus général ce que fait `withMailDryRun` (tests/domain/helpers/api-fixtures.ts). Correction : déplacer `withEnv` dans tests/domain/helpers/ (en version async) et en dériver `withMailDryRun`.

## Conventions

- [x] components/site/email-verification-banner.tsx:36 — `verify as keyof typeof FEEDBACK` est un cast, et `in` lit aussi le prototype (`?verify=toString`). Correction : une garde `Object.hasOwn`, ou un `switch` sur les quatre valeurs.
- [x] app/layout.tsx:80 — La règle « ce compte doit confirmer son adresse » est écrite dans app/, qui ne doit pas contenir de règle métier (AGENTS.md), et répète celle de `verifiedUser` et de `toMe`. Correction : une fonction unique, utilisée par la page, la commande et `toMe`.
- [x] app/confirmer-email/[token]/page.tsx:68 — `canResend` répète la même règle dans app/. Correction : appeler la fonction unique du point précédent.

## i18n

Aucun point.
