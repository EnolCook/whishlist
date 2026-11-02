# Research: Liens qui ouvrent l'app

Phase 0 du plan. Chaque décision part du code existant (au 2026-11-02) et de la spec.

## R1. Mécanisme : liens universels iOS et App Links Android, sur les adresses actuelles

- **Decision** : garder les liens `https://ohyoushouldnt.app/...` tels quels. Le domaine publie deux fichiers d'association :
  - `/.well-known/apple-app-site-association` pour iOS ;
  - `/.well-known/assetlinks.json` pour Android.

  L'app déclare le domaine : `ios.associatedDomains` et `android.intentFilters` avec `autoVerify` dans `mobile/app.config.ts`.
- **Rationale** : FR-002 demande que le même lien ouvre l'app ou le site, y compris pour les liens déjà envoyés. Seuls les liens universels et les App Links le permettent. Ils ouvrent l'app sans demander, et ils retombent sur le site quand l'app est absente ou quand le domaine n'est pas vérifié. Sur Android 12 et plus, un domaine non vérifié ouvre le navigateur, sans fenêtre de choix.
- **Alternatives considered** :
  - Schéma propre (`ohyoushouldnt://…`) dans les e-mails : ce lien ne marche pas sans l'app (FR-002), et les clients de messagerie le bloquent souvent.
  - Page relais qui tente le schéma puis retombe sur le site : un aller-retour visible, peu fiable sur iOS, et les liens déjà envoyés ne sont pas couverts.
  - Service de liens tiers (Branch, Firebase Dynamic Links, ce dernier fermé) : service externe non optionnel et données envoyées à un tiers (constitution, principe V).

## R2. Fichiers d'association servis par le site, réglés par variables d'environnement

- **Decision** : deux route handlers :
  - `app/.well-known/apple-app-site-association/route.ts` ;
  - `app/.well-known/assetlinks.json/route.ts` (le dossier porte l'extension, comme `rss.xml/route.ts` dans la doc de Next).

  Tous deux sont générés par des fonctions pures de `src/site/app-links.ts`. Le JSON est servi tel quel, `content-type: application/json`, sans redirection. Ils lisent :
  - `APPLE_TEAM_ID` : identifiant d'équipe Apple. L'app ID vaut `<TEAM_ID>.app.ohyoushouldnt.mobile`.
  - `ANDROID_CERT_SHA256` : empreintes SHA-256 du certificat de signature Play et de la clé d'envoi, séparées par des virgules.

  Sans la variable, la route répond 404 : l'app n'ouvre pas les liens et le site marche comme avant (constitution, « services externes optionnels »). Les deux variables suivent la règle d'AGENTS.md : README, `.env.example`, `deploy/compose.prod.yml` (`WHISHLIST_APPLE_TEAM_ID`, `WHISHLIST_ANDROID_CERT_SHA256`).
- **Rationale** :
  - Ces valeurs ne sont pas secrètes, mais elles dépendent du compte développeur et de la signature Play. Les garder hors du code évite d'écrire des identifiants de compte dans le dépôt (principe I) et permet un serveur de démo sans association.
  - D'après la doc de Next 16.4, les chemins sous `.well-known/` gardent leur forme exacte (pas de `trailingSlash`), et un route handler peut y répondre.
  - Le `matcher` de `proxy.ts` doit exclure `.well-known/`, pour que la langue n'y ajoute ni redirection ni préfixe. Apple refuse un fichier servi après une redirection.
- **Alternatives considered** :
  - Fichiers statiques dans `public/.well-known/` : il faudrait les écrire à la main avec les identifiants dans le dépôt, sans désactivation possible.
  - Identifiants en dur dans le code : contraire au principe I, et à la démo qui n'a pas ces comptes.

## R3. Chemins revendiqués : une seule table partagée par le site et l'app

- **Decision** : `src/site/app-links.ts` (module pur, repris par l'app comme `src/i18n/`) exporte :
  - `APP_LINK_ROUTES` : la liste des chemins du site que l'app sait traiter, avec leur écran dans l'app (table dans [contracts/links.md](./contracts/links.md)) ;
  - `appPathForSiteUrl(url)` : transforme une adresse du site, avec ou sans le préfixe `/en`, avec ou sans le schéma de l'app, en chemin de l'app, ou `null`.

  Le fichier Apple (`components`) et les filtres Android (`pathPrefix`/`pathPattern`) sont tirés de la même table :
  - par `src/site/app-links.ts` pour le site ;
  - par `mobile/app.config.ts` pour l'app, qui importe déjà des JSON du site.
- **Rationale** :
  - FR-003 : seuls les chemins traités par l'app sont revendiqués. L'accueil, le guide, la FAQ, les pages légales et `/compte/export` restent au site, même avec l'app installée.
  - Une table unique évite qu'un chemin soit revendiqué sans écran dans l'app, ou l'inverse. Un test dans chaque package le vérifie.
- **Alternatives considered** :
  - Revendiquer tout le domaine et renvoyer au navigateur les chemins inconnus : sur iOS, ouvrir un lien universel de son propre domaine depuis l'app rouvre l'app, et la personne tourne en rond.
  - Deux listes, une dans le site et une dans l'app : elles finiraient par diverger.

## R4. Réception dans l'app : `+native-intent.tsx` (`redirectSystemPath`)

- **Decision** : `mobile/app/+native-intent.tsx` exporte `redirectSystemPath({ path })`. Il appelle `appPathForSiteUrl` et renvoie le chemin de l'app (par exemple `/links/confirm-email/<token>`), ou `/` pour une adresse inconnue. Il est enveloppé d'un `try/catch` : la doc d'expo-router prévient qu'une erreur ici fait planter l'app. Les écrans des liens vivent hors des groupes `(app)` et `(auth)`, dans `mobile/app/links/` et `mobile/app/guest/`, pour ne pas être redirigés par leurs gardes de session.
- **Rationale** :
  - expo-router 58 fournit ce point d'entrée pour réécrire une adresse entrante, au premier lancement comme quand l'app tourne déjà.
  - Les chemins du site sont en français (`/reinitialiser`), et les identifiants de l'app restent en anglais (AGENTS.md).
- **Alternatives considered** :
  - Nommer les routes de l'app comme celles du site (`mobile/app/reinitialiser/[token].tsx`) : contraire à la règle des identifiants anglais, et le préfixe `/en` doublerait chaque route.
  - `Linking.addEventListener` à la main : expo-router traite déjà l'adresse initiale et les suivantes, et un second écouteur ferait naviguer deux fois.

## R5. Action à la reprise après connexion (lien d'invitation, `suite`)

- **Decision** : `mobile/src/links/pending.ts` garde en mémoire le chemin d'un lien qui demande d'être connecté, aujourd'hui l'invitation. L'écran du lien, sans session, enregistre ce chemin et ouvre la connexion (ou l'inscription). Une fois la session ouverte, `(auth)/_layout.tsx` renvoie vers ce chemin au lieu de `/`, et l'efface. Le changement de mot de passe imposé passe d'abord (`change-password` reprend aussi le chemin). Après une confirmation d'adresse dont le lien porte `suite=/inviter/<token>`, l'app propose de reprendre l'invitation, comme le site.
- **Rationale** : FR-006, sans rouvrir le lien. Un chemin en mémoire suffit : le passage par la connexion se fait dans la même session de l'app. Après un arrêt de l'app, la personne rouvre le lien.
- **Alternatives considered** : garder le chemin dans SecureStore. C'est une écriture de plus, pour un cas rare (l'app tuée entre le lien et la connexion).

## R6. Confirmation de l'adresse dans l'app : à l'ouverture, sans bouton

- **Decision** : l'écran `links/confirm-email/[token]` appelle tout de suite `POST /auth/email-confirmation` (nouvelle route, bearer optionnel). Il affiche ensuite le résultat, rafraîchit le profil (`refreshMe`) et propose la suite :
  - ses listes ;
  - la connexion ;
  - l'invitation, si la `suite` en porte une ;
  - « Mon compte », après un changement d'adresse.
- **Rationale** :
  - SC-002 : un seul toucher sur le lien.
  - Le site garde son bouton parce que les antivirus de messagerie ouvrent les liens web avant la personne (feature 010, R4). Ils n'ouvrent pas l'app : quand l'app reçoit le lien, c'est la personne qui l'a touché.
  - La commande `confirmEmailWithToken` existe déjà, avec sa limite de 20 essais par 15 min et par IP.
- **Alternatives considered** :
  - Reprendre le bouton du site : un geste de plus, sans la raison qui l'impose sur le web.
  - Un aperçu (`GET`) avant l'action : inutile sans bouton.

## R7. Réinitialisation du mot de passe dans l'app

- **Decision** :
  - Déplacer la logique de `resetPasswordAction` (aujourd'hui `resetPasswordWithToken` appelé depuis `src/server/actions.ts`) dans une commande `resetPasswordWithLink` de `src/server/commands/auth.ts`. Elle ajoute la limite de débit (`rateLimitForIp("password-reset-confirm", …)`, 20 par 15 min).
  - La server action et la nouvelle route `POST /auth/password-reset/confirm` l'appellent toutes les deux.
  - Le corps de la route est `{ token, password, signIn }`. Avec `signIn: true`, la réponse contient une session (comme `/auth/login`).
  - L'app passe `signIn` à vrai seulement si personne n'y est connecté. Une personne connectée à un autre compte garde sa session (cas limite de la spec).
- **Rationale** :
  - AGENTS.md : la logique partagée par le site et l'API vit dans `src/server/commands/`.
  - Le site ouvre une session après la réinitialisation, et l'app fait de même quand elle le peut.
  - Les autres sessions du compte sont déjà invalidées par `sessionVersion`.
- **Alternatives considered** :
  - Toujours ouvrir une session : elle resterait orpheline quand l'app est connectée à un autre compte.
  - Ne jamais en ouvrir : la personne doit retaper son adresse, ce qui fait une étape de plus que sur le site.

## R8. Invitation dans l'app : aperçu puis bouton

- **Decision** :
  - Nouvelle route `GET /invitations/{inviteToken}` (bearer exigé). Elle rend `{ title, listId }`, où `listId` n'est rempli que si le compte est déjà membre (scénario US2-4). Une invitation inconnue ou révoquée donne 404 `inviteLinkBroken` (code de `acceptInvite`).
  - L'écran affiche le titre et le bouton « Rejoindre », qui appelle la route existante `POST /invitations/{inviteToken}/accept`.
  - Après l'acceptation, l'app rafraîchit ses listes (synchro) et ouvre `/lists/<listId>`.
  - `emailNotVerified` (403) montre le bandeau de vérification existant (`VerificationBanner`) avec le renvoi du lien.
- **Rationale** : la spec demande le nom de la liste et un bouton (US2-1). Le titre n'est montré qu'à un compte connecté, comme sur le site, qui n'affiche le titre qu'après connexion.
- **Alternatives considered** : accepter à l'ouverture, comme la page du site (`joinInviteAction` au rendu). La spec veut un bouton, et rejoindre une liste engage davantage que confirmer une adresse.

## R9. Vue invité dans l'app (US4)

- **Decision** :
  - Écrans `mobile/app/guest/[readToken]/index.tsx` (liste, filtre par catégorie) et `guest/[readToken]/reserve.tsx` (« Je veux offrir » : une idée choisie, ou le choix d'une catégorie puis d'une idée, nom, petit mot).
  - Ils appellent les routes publiques existantes : `GET /public/lists/{readToken}`, `/unlock`, `/reservations` et `DELETE …/reservations/{id}`. Aucune nouvelle route n'est nécessaire.
  - Jetons stockés sur le téléphone, dans SecureStore :
    - le jeton de déverrouillage (`X-Read-Unlock`) par `readToken`, avec son `expiresAt` (14 jours, comme le cookie du site) ;
    - les claims de réservation (`X-Reservation-Claims`), 90 jours, purgés à expiration.
  - Un membre est reconnu avant tout appel réseau : la copie locale des listes donne pour chaque liste son `readUrl`, qui contient le `readToken`. Il est alors renvoyé vers `/lists/<listId>` (US4-3).
  - Réserver et annuler demandent le réseau et ne passent jamais par la file hors ligne (FR-010b, principe III).
  - La mise en page suit la page publique du site (captures mobiles de `specs/005-mobile-list-app/design/web-mobile/`) et compose les composants de `mobile/src/ui/` (AGENTS.md : aucun style en dur dans un écran).
- **Rationale** :
  - L'API de la feature 004 a été faite pour un client invité : claims, déverrouillage, bearer optionnel pour `mine`.
  - Le choix de la personne (vue invité complète) n'ajoute donc que des écrans.
- **Alternatives considered** :
  - Mettre les listes publiques dans la base locale : il faudrait les synchroniser, et une copie hors ligne des idées libres pousserait à réserver une idée déjà prise.
  - Une WebView de la page publique : ce ne serait pas une vraie vue de l'app, et la session et les claims seraient à part.

## R10. Builds : domaine selon la variante, schéma pour les tests

- **Decision** :
  - `associatedDomains` et les `intentFilters` ne sont posés que si `EXPO_PUBLIC_API_URL` est en `https`. Le domaine est l'hôte de cette adresse, donc la production pour les builds de store.
  - Les builds locaux (`http://localhost:3010`) et la suite Maestro passent par le schéma `ohyoushouldnt://` déjà déclaré : `ohyoushouldnt://confirmer-email/<token>` donne le même chemin que l'adresse web, et `appPathForSiteUrl` traite les deux formes.
  - Un script Maestro, `scripts/app-link.js`, transforme l'adresse lue dans MailDev (`maildev-link.js`) en lien au schéma de l'app.
- **Rationale** :
  - Les liens universels exigent un domaine en HTTPS, joignable par le CDN d'Apple : impossible sur `localhost`.
  - Le schéma rejoue le même chemin de code (`redirectSystemPath` → écran), donc la suite e2e teste la vraie réception.
  - Les fichiers d'association se testent en unitaire (R2).
- **Alternatives considered** :
  - Un tunnel HTTPS public pour la suite e2e : dépendance réseau et compte externe, pour vérifier une chose (l'association du domaine) qui se contrôle une fois à la main en production (quickstart).

## R11. Sécurité du schéma `ohyoushouldnt://`

- **Decision** : les liens au schéma déclenchent les mêmes écrans que les liens web. Aucun écran n'élargit les droits :
  - le jeton du lien porte toute l'autorisation ;
  - les appels passent par les mêmes commandes et limites que le site (FR-008) ;
  - rejoindre une liste demande un toucher sur le bouton ;
  - réinitialiser demande de saisir le mot de passe.

  Une autre app peut ouvrir un lien au schéma, mais elle doit alors détenir un jeton valide. Confirmer l'adresse du compte du jeton n'agit que sur ce compte (feature 010, cas limite « lien ouvert par une autre personne »).
- **Rationale** : n'importe quelle app peut appeler un schéma propre. Ce qui compte est qu'il n'ouvre rien que le jeton ne permette déjà sur le web.
- **Alternatives considered** : limiter le schéma aux builds de développement. L'app publiée le déclare déjà (retour de connexion, partage), et l'en retirer n'apporte rien de plus.

## R12. Jetons hors des journaux

- **Decision** : les écrans des liens et `redirectSystemPath` n'écrivent pas l'adresse reçue dans la console en production. Le côté serveur garde les règles de la 010 (masquage des URL dans `mail.log`). Les nouvelles routes ne journalisent pas leur corps.
- **Rationale** : FR-009.

## R13. Icône « l'app sur votre téléphone » du site

- **Decision** :
  - Composant client `components/site/get-app-button.tsx`, placé dans l'en-tête de `app/layout.tsx` à côté de `SiteNav` :
    - un bouton icône (`Smartphone` de lucide-react, `aria-label` traduit) ;
    - un `Dialog` de `components/ui/dialog.tsx` (Base UI : fermeture par bouton, clic hors fenêtre et Échap, focus piégé, FR-014).
  - Le layout, côté serveur, lui passe les adresses des fiches : `APP_STORE_URL` et `PLAY_STORE_URL`, variables optionnelles (README, `.env.example`, `WHISHLIST_APP_STORE_URL` et `WHISHLIST_PLAY_STORE_URL` dans compose). Sans aucune des deux, le composant n'est pas rendu (FR-015).
  - Détection du téléphone, après hydratation (pas de rendu côté serveur, pas d'écart d'hydratation), par une fonction pure `phonePlatform(userAgent, uaDataMobile)` de `src/site/device.ts` :
    - « ios » pour un iPhone ou un iPod ;
    - « android » pour Android avec `Mobile` (les tablettes Android n'ont pas ce mot) ;
    - `null` sinon : ordinateur, iPad (qui se présente en Mac depuis iPadOS 13), tablette.
  - Animation CSS `@keyframes phone-ring` dans `app/globals.css` : une oscillation d'une seconde jouée 5 fois (`animation: phone-ring 1s ease-in-out 5`), qui s'arrête d'elle-même à 5 s (SC-004). Au toucher, un état React retire la classe et l'animation s'arrête aussitôt. `motion-reduce:animate-none` couvre FR-012.
  - Le badge du système du téléphone vient en premier dans la fenêtre.
  - Les badges sont les visuels officiels, localisés FR et EN, dans `public/badges/{fr,en}/`, utilisés selon les règles d'usage d'Apple et de Google (sans modification, avec la marge prévue).
- **Rationale** :
  - La détection n'a besoin que du navigateur, et la faire côté client évite de rendre dynamique la mise en page commune.
  - Une animation CSS bornée par son nombre d'itérations s'arrête sans minuterie JavaScript, même si l'onglet est en arrière-plan.
  - Réutiliser `Dialog` suit la règle UI d'AGENTS.md.
- **Alternatives considered** :
  - Détecter le téléphone côté serveur par `User-Agent` : toutes les pages deviendraient dépendantes de l'en-tête, et le cache varierait.
  - Les bannières natives (Smart App Banner iOS `apple-itunes-app`, sans équivalent Android) : elles n'existent que sur Safari iOS, et la demande décrit une icône et une fenêtre propres au site.
  - Une minuterie JS de 5 s : redondante avec le nombre d'itérations.

## R14. Version de l'API et de l'app

- **Decision** :
  - Le contrat passe en `1.4.0`, avec trois ajouts rétrocompatibles :
    - `POST /auth/email-confirmation` ;
    - `POST /auth/password-reset/confirm` ;
    - `GET /invitations/{inviteToken}`.
  - L'app passe en `1.1.0`. Les ajouts natifs (domaines associés, filtres d'intention) demandent un nouveau build EAS et une nouvelle soumission aux stores. Sans mise à jour, l'ancienne app laisse les liens au site (cas limite de la spec).
  - Les descriptions de `/auth/password-reset` et `/me/email-verification` (« Le lien ouvre le site ») sont mises à jour.
- **Rationale** : l'app 1.0.0 est soumise et doit continuer de marcher (contrat rétrocompatible, comme pour la 010).
