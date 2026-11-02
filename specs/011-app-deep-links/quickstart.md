# Quickstart: Liens qui ouvrent l'app

Parcours de validation à la main (principe IV), complétés par la suite Maestro pour l'app. Contrats : [links.md](./contracts/links.md), [api.md](./contracts/api.md).

## Prérequis

```sh
npm ci && npm --prefix mobile ci
npm run demo:data -- tmp/demo-wishlist.json
# Serveur de démo avec e-mails dans MailDev (http://localhost:1080)
MAIL_SMTP_URL=smtp://localhost:1025 WISHLIST_DATA_PATH=tmp/demo-wishlist.json DEMO_PASSWORD=… PORT=3010 npm run dev
# App sur le simulateur de référence, pointée sur ce serveur
EXPO_PUBLIC_API_URL=http://localhost:3010 npm --prefix mobile run ios
```

En local, les liens web ne peuvent pas ouvrir l'app (pas de domaine HTTPS associé, [research R10](./research.md#r10-builds--domaine-selon-la-variante-schéma-pour-les-tests)). On les ouvre avec le schéma de l'app, sur le même chemin que l'adresse du site :

```sh
# http://localhost:3010/confirmer-email/abc  →
xcrun simctl openurl booted "ohyoushouldnt://confirmer-email/abc"
# Android : adb shell am start -a android.intent.action.VIEW -d "ohyoushouldnt://confirmer-email/abc"
```

## US1 : liens des e-mails de compte

1. Dans l'app, créer un compte `us1-<n>@example.test`. Le bandeau de confirmation s'affiche.
2. Dans MailDev, copier le lien de confirmation et l'ouvrir au schéma. **Attendu** : l'app affiche « adresse confirmée », le bandeau a disparu, le bouton mène aux listes.
3. Rouvrir le même lien. **Attendu** : « lien plus valide », comme sur le site.
4. Se déconnecter, puis demander « mot de passe oublié » pour ce compte. Ouvrir le lien de MailDev au schéma. **Attendu** : le formulaire du nouveau mot de passe. Un mot de passe trop court est refusé avec le message du site. Un mot de passe valide connecte la personne et ouvre ses listes.
5. Dans « Mon compte », demander un changement vers `us1-<n>-new@example.test`. Ouvrir le lien reçu au schéma. **Attendu** : changement confirmé, « Mon compte » affiche la nouvelle adresse, et MailDev contient l'avis envoyé à l'ancienne.
6. Ouvrir le lien `/en/connexion` au schéma, connecté puis déconnecté. **Attendu** : ses listes, puis l'écran de connexion.
7. Ouvrir les mêmes liens dans Safari, sur un ordinateur. **Attendu** : le site, comme avant.

Maestro : `DEMO_PASSWORD=… npm --prefix mobile run e2e -- .maestro/flows/011-us1-email-links.yaml`.

## US2 : invitation

1. Sur le site, avec `alice@example.test`, copier le lien d'invitation d'une liste.
2. Dans l'app, connectée à un autre compte vérifié, ouvrir ce lien au schéma. **Attendu** : le titre de la liste et « Rejoindre ». Après le toucher, la liste s'ouvre et apparaît dans « Mes listes ».
3. Rouvrir le lien. **Attendu** : la liste s'ouvre tout de suite (déjà membre).
4. Se déconnecter, puis ouvrir le lien d'une autre liste. **Attendu** : connexion ou inscription, puis l'écran de l'invitation, sans rouvrir le lien.
5. Avec un compte non vérifié, ouvrir le lien. **Attendu** : le message « confirmez votre adresse » et le renvoi du lien.
6. Sur le site, régénérer le lien d'invitation, puis ouvrir l'ancien dans l'app. **Attendu** : le message du site pour un lien invalide.

Maestro : `.maestro/flows/011-us2-invite-link.yaml`.

## US3 : icône de l'app sur le site

Démarrer le serveur avec `APP_STORE_URL=https://apps.apple.com/app/id6829423495` et `PLAY_STORE_URL=https://play.google.com/store/apps/details?id=app.ohyoushouldnt.mobile`.

1. Dans Chrome, mode appareil « iPhone », ouvrir `http://localhost:3010/`. **Attendu** : l'icône de téléphone dans l'en-tête, qui oscille puis s'arrête au plus tard 5 s après (chronométrer).
2. Recharger, puis toucher l'icône pendant l'animation. **Attendu** : l'animation s'arrête tout de suite, la fenêtre s'ouvre avec le badge App Store en premier, puis Google Play, et la mention des marques d'Apple et de Google en dessous.
3. Mode « Pixel » : le badge Google Play vient en premier.
4. Fermer avec le bouton, en cliquant à côté, puis avec Échap. **Attendu** : retour à la page.
5. Activer « réduire les animations » (DevTools → Rendering → `prefers-reduced-motion: reduce`). **Attendu** : l'icône apparaît sans osciller.
6. Mode ordinateur, puis « iPad ». **Attendu** : pas d'icône.
7. Sans `PLAY_STORE_URL` : seul le badge App Store. Sans les deux variables : pas d'icône.
8. En anglais (`/en`) : textes et badges en anglais.
9. Sur un vrai iPhone et un vrai téléphone Android, sur la production après déploiement : mêmes vérifications.

Pas de test e2e du site (AGENTS.md). La fonction `phonePlatform` est testée dans `tests/domain/device.test.ts`.

## US4 : vue invité

1. Copier le lien public d'une liste de démo (écran Partage de l'app, ou page de la liste sur le site).
2. App déconnectée, ouvrir `ohyoushouldnt://l/<readToken>`. **Attendu** : la vue invité (titre, idées libres, catégories), sans action de membre.
3. Toucher « J'offre » sur une idée, saisir un nom et un petit mot, valider. **Attendu** : l'idée est marquée comme la vôtre. Sur le site, elle n'est plus proposable. Le compte d'un membre voit le nom et le mot dans les réservations.
4. Annuler la réservation depuis la vue invité. **Attendu** : l'idée redevient libre.
5. Liste protégée (mot de passe posé sur le site) : le mot de passe est demandé. Un mot de passe faux est refusé avec le message du site. Le bon déverrouille, et la liste reste déverrouillée après un redémarrage de l'app.
6. Connecté à un compte membre de la liste, ouvrir le lien. **Attendu** : la vue membre de la liste.
7. Mode avion, puis « J'offre ». **Attendu** : l'erreur réseau, sans réservation en attente.
8. Lien public inconnu. **Attendu** : « liste introuvable ».

Maestro : `.maestro/flows/011-us4-guest-list.yaml`.

## Production (une fois, après déploiement et builds 1.1.0)

1. Régler `WHISHLIST_APPLE_TEAM_ID`, `WHISHLIST_ANDROID_CERT_SHA256` (empreintes de Play Console → Intégrité de l'app → Signature), `WHISHLIST_APP_STORE_URL` et `WHISHLIST_PLAY_STORE_URL`, puis redéployer.
2. `curl -sI https://ohyoushouldnt.app/.well-known/apple-app-site-association` : `200`, `application/json`, sans redirection. Même chose pour `/.well-known/assetlinks.json`.
3. Contrôler l'association :
   - iOS : `https://app-site-association.cdn-apple.com/a/v1/ohyoushouldnt.app` rend le fichier ;
   - Android : `adb shell pm get-app-links app.ohyoushouldnt.mobile` affiche `verified`.
4. Sur un iPhone et un Android avec l'app 1.1.0 (TestFlight ou test fermé), toucher un lien de réinitialisation reçu dans l'app Mail ou Gmail. **Attendu** : l'app s'ouvre sur le formulaire. Sans l'app, le site s'ouvre.
5. Toucher le lien d'une page non revendiquée (`/guide`). **Attendu** : le site, même avec l'app installée.

Le compte de démo et les e-mails de ces essais utilisent des adresses fictives ou personnelles, hors du dépôt (principe I).
