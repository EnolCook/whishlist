# Quickstart : vérifier la validation et le changement d'adresse

Ce sont les parcours réels qui confirment chaque story (principe IV). Ils se font sur la base de démo, sans Resend : le serveur envoie ses e-mails à MailDev (`MAIL_SMTP_URL`, ignorée en production), la même boîte que la suite Maestro de l'app.

## Préparation

```sh
npm ci
npx maildev@3.0.0 --smtp 1025 --web 1080          # boîte de réception : http://localhost:1080
DEMO_PASSWORD=… npm run demo:data -- tmp/demo-wishlist.json
MAIL_SMTP_URL=smtp://localhost:1025 WISHLIST_DATA_PATH=tmp/demo-wishlist.json SESSION_SECRET=dev-secret-dev-secret-dev-secret-00 npm run dev -- --port 3010
```

Les e-mails se lisent dans MailDev (<http://localhost:1080>), un par destinataire, liens cliquables. L'app : `EXPO_PUBLIC_API_URL=http://localhost:3010 npm --prefix mobile run ios`, sur le simulateur du projet.

Sans MailDev, `MAIL_DRY_RUN=1` à la place de `MAIL_SMTP_URL` écrit les e-mails dans `data/mail.log`, et le site affiche les liens en dev ([research R2](./research.md#r2-tester-sans-resend--mode-denvoi-simulé)).

Contrôles automatiques : `npm run lint && npm run typecheck && npm test`, puis `npm --prefix mobile run lint && npm --prefix mobile run typecheck && npm --prefix mobile test`. Parcours de l'app (`010-us1`, `010-us2`, `010-us3`, avec MailDev) : `DEMO_PASSWORD=… npm --prefix mobile run e2e`, voir `mobile/.maestro/README.md`.

## Base : comptes de démo et reprise

1. Se connecter avec `alex@example.test` : aucun bandeau. Le compte est vérifié, comme tout compte créé avant la feature.
2. `npm run db:check -- tmp/demo-wishlist.db --counts` : la table `email_confirmations` existe et est vide.
3. Sur une copie de la sauvegarde de prod (jamais sur la prod elle-même), lancer le serveur une fois. Tous les comptes ont alors `email_verified_at` rempli.

## US1 : confirmer son adresse

1. Site, `/inscription` : créer `sam@example.test`. La page dit de consulter sa boîte. MailDev reçoit « Confirmez votre adresse e-mail » pour `sam@example.test`.
2. Le bandeau « Confirmez votre adresse » apparaît sur toutes les pages.
3. « Créer une liste » est refusé avec le message `emailNotVerified`. La réservation sur une liste de démo, par son lien de lecture, fonctionne.
4. Dans l'app, connectée avec `sam@example.test` : le bandeau apparaît sur « Mes listes » et « Mon compte », et « Créer une liste » est désactivé avec sa raison.
5. Copier le lien de l'e-mail et l'ouvrir dans un autre navigateur, non connecté : l'adresse est masquée. Cliquer sur « Confirmer » : la page confirme et propose la connexion.
6. Revenir au premier navigateur : le bandeau a disparu, et la création de liste fonctionne. Repasser l'app au premier plan : son bandeau a disparu.
7. Rouvrir le même lien : « Ce lien n'est plus valide ». Non connecté, la page propose de se connecter pour en demander un nouveau.
8. Invitation : depuis `alex`, copier le lien d'invitation d'une liste. Dans une fenêtre privée, l'ouvrir puis s'inscrire avec `lou@example.test`. Le lien reçu dans MailDev porte `suite=/inviter/…`. Une fois l'adresse confirmée, « Reprendre l'invitation » fait rejoindre la liste.
9. Échec d'envoi : arrêter MailDev, créer `zoe@example.test`. La page dit que l'e-mail n'a pas pu partir. Relancer MailDev, puis « Renvoyer le lien » depuis le bandeau.
10. Sans `MAIL_SMTP_URL` (redémarrer le serveur sans elle), créer `noa@example.test` : ni bandeau, ni refus.

## US2 : renvoyer le lien

1. Avec un compte non vérifié, cliquer sur « Renvoyer le lien » dans le bandeau. Un second e-mail arrive dans MailDev. Le lien du premier affiche « n'est plus valide », le nouveau confirme.
2. Renvoyer 6 fois en moins d'une heure : la 6ᵉ demande est refusée (limite de débit). En dev, la limite ne s'applique qu'avec une IP de proxy : ajouter l'en-tête `x-real-ip` (par exemple avec `curl` sur `POST /api/v1/me/email-verification`).
3. Dans l'app : « Renvoyer le lien » depuis le bandeau affiche la confirmation de l'envoi, et l'e-mail arrive dans MailDev. En mode avion (Android), le bouton indique qu'il faut le réseau.

## US3 : changer d'adresse

1. Site, `/compte`, connectée en `camille@example.test` : la carte « Adresse de connexion » montre l'adresse et son badge « Confirmée ». Saisir `camille.b@example.test` avec un mauvais mot de passe : la demande est refusée, et MailDev ne reçoit rien.
2. Recommencer avec le bon mot de passe : « Changement en attente vers `camille.b@example.test` ». MailDev reçoit « Confirmez votre nouvelle adresse » pour `camille.b@example.test`. La connexion se fait toujours avec l'ancienne adresse.
3. Essayer `alex@example.test` : même réponse qu'une adresse libre (« changement en attente »), mais MailDev ne reçoit rien pour alex@. Essayer `Camille@Example.test` : `emailUnchanged`.
4. Ouvrir le lien de l'e-mail (connectée en camille) et confirmer : « Votre adresse de connexion est maintenant `camille.b@example.test` ». MailDev reçoit, pour `camille@example.test`, l'avis « Votre adresse de connexion a changé », avec la nouvelle adresse masquée et l'adresse de contact comme seul recours.
5. Se déconnecter. `camille@example.test` est refusé, `camille.b@example.test` est accepté. « Mot de passe oublié » avec la nouvelle adresse : l'e-mail arrive à `camille.b@example.test`.
6. Annulation : demander un autre changement puis cliquer sur « Annuler le changement ». Le lien reçu affiche « n'est plus valide ».
7. Course : depuis deux comptes, demander la même adresse libre, confirmer le premier lien puis le second. Le second est refusé (`emailTaken`) et l'adresse de son compte ne change pas.
8. Reprise du compte : demander un changement, puis réinitialiser le mot de passe par « Mot de passe oublié ». Le lien du changement affiche « n'est plus valide ».
9. App : carte « Adresse de connexion » de « Mon compte ». Faire la même demande, voir le changement en attente, l'annuler. Le parcours Maestro `010-us3` rejoue la demande, la confirmation par MailDev, l'avis à l'ancienne adresse et la reconnexion.
10. Sans `MAIL_SMTP_URL` : le changement s'applique dès l'envoi du formulaire.

## Export et suppression

1. « Exporter mes données » d'un compte avec un changement en attente : le fichier contient `emailVerifiedAt` et `pendingEmail`.
2. Supprimer ce compte : la suppression réussit (aucune clé étrangère orpheline) et le lien en attente affiche « n'est plus valide ».

## Production

Après le déploiement, sur `macbuntu` : `RESEND_API_KEY` et `MAIL_FROM` sont déjà remplis, `MAIL_SMTP_URL` et `MAIL_DRY_RUN` sont absents (et ignorés en production). Créer un compte de test sur une vraie adresse personnelle (hors dépôt), recevoir l'e-mail, confirmer, puis supprimer le compte.
