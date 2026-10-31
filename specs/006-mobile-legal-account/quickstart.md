# Quickstart: vérifier les pages légales, l'export et la suppression du compte

Parcours manuels sur la base de démo (principe IV), sur simulateur iOS et émulateur Android, et sur le site. Ils complètent `npm test` et `npm --prefix mobile test`.

La partie « dans l'app » de ces parcours est automatisée par la suite e2e (`npm --prefix mobile run e2e`, voir [mobile/.maestro/README.md](../../mobile/.maestro/README.md)). Ce qu'elle ne vérifie pas est listé dans [mobile/.maestro/exclusions.md](../../mobile/.maestro/exclusions.md).

## Prérequis

Mêmes que le [quickstart de la 005](../005-mobile-list-app/quickstart.md#prérequis). Recréer la base de démo avant chaque parcours de suppression : on ne peut pas revenir en arrière.

Comptes : `alex@example.test`, propriétaire de « Nos envies toute l'année », partagée avec `camille@example.test`. Pour la suppression, créer en plus `lou@example.test` dans l'app.

## US2 : mentions légales et données personnelles

1. Déconnecté, sur l'écran de connexion → lien « Mentions légales » : éditeur, hébergeur « serveur personnel de l'éditeur, diffusé via Cloudflare, Inc. », contact. Comparer à la page `/mentions-legales` du site ouverte sur téléphone.
2. Retour → « Données personnelles » : chaque section de [research.md R8](research.md#r8--contenu-de--données-personnelles-), Cloudflare compris. Comparer à la page `/donnees-personnelles` du site ouverte sur téléphone.
3. Serveur sans `RESEND_API_KEY` ni clé IA ni Umami → aucun paragraphe de ces prestataires. Avec une clé IA configurée → le paragraphe IA apparaît après réouverture de la page.
4. Mode avion → les deux pages s'affichent à l'identique.
5. Téléphone en anglais → pages en anglais, identiques à `/en/mentions-legales` et `/en/donnees-personnelles`.
6. Texte agrandi au maximum → rien de coupé.
7. Site : `/donnees-personnelles` est publique, dans `sitemap.xml`, et le pied de page y mène depuis « Mentions légales ».

## US1 : supprimer son compte

**Liste seule et liste partagée.**

1. Dans l'app, créer `lou@example.test`, puis une liste « Anniversaire Lou » avec une idée.
2. Sur le site, connecté avec Alex : régénérer le lien d'invitation, et le faire accepter par Lou, qui devient membre de « Nos envies toute l'année ».
3. Sur la page publique d'une liste d'Alex, connecté avec Lou, réserver une idée avec le nom « Lou » et un petit mot.
4. Dans l'app, avec Lou : Mon compte → descendre tout en bas. Ordre attendu : données et informations, Se déconnecter, Supprimer mon compte (destructif).
5. Supprimer mon compte → l'écran annonce 1 liste supprimée (« Anniversaire Lou »), 1 liste qui reste (« Nos envies toute l'année », sans changement de propriétaire), 1 cadeau qui reste réservé.
6. Mot de passe faux → « mot de passe incorrect », rien de supprimé (Lou est toujours connectée sur le site).
7. Bon mot de passe → écran de connexion, « Votre compte a été supprimé. »
8. Vérifier :
   - se connecter avec Lou (app et site) → « E-mail ou mot de passe incorrect » ;
   - la session de Lou sur le site, ouverte dans un autre navigateur → redirigée vers la connexion au rechargement ;
   - « Anniversaire Lou » n'existe plus (son ancien lien public → page introuvable) ;
   - « Nos envies toute l'année » : Lou n'est plus dans les membres, l'idée est toujours réservée avec « Lou » et le petit mot (onglet Réservations d'Alex) ;
   - `grep -c "<id de Lou>" tmp/demo-wishlist.json` → 0.
9. Recréer `lou@example.test` → compte neuf, aucune liste.

**Propriétaire d'une liste partagée.**

10. Base de démo neuve. Avec Alex : Supprimer mon compte → « Nos envies toute l'année » passe à Camille. Confirmer, puis se connecter avec Camille sur le site → elle est propriétaire (elle peut poser le mot de passe de lecture).

**Changements en attente.**

11. Avec un compte jetable, en mode avion : « Supprimer mon compte » est désactivé, avec le message hors ligne.
12. Pour l'alerte FR-016 : couper le serveur (pas le réseau), ajouter une idée (elle reste en attente, serveur injoignable), relancer le serveur et ouvrir aussitôt Supprimer mon compte → l'alerte « 1 changement jamais envoyé sera perdu » est visible. (Si la file est partie entre-temps, l'alerte n'apparaît pas : c'est le comportement attendu.)

**Site.**

13. Sur le site, `/compte` → tout en bas, « Supprimer mon compte » → même aperçu, même confirmation, puis `/connexion` avec le message de confirmation.

**Limite.**

14. 11 mots de passe faux en moins de 15 minutes → « trop de tentatives ».

## US3 : récupérer ses données

1. Avec Alex, dans l'app : Mon compte → Télécharger mes données → la feuille de partage propose `ohyoushouldnt-donnees-AAAA-MM-JJ.json`. L'enregistrer dans Fichiers et l'ouvrir.
2. Contrôler : profil d'Alex ; « Nos envies toute l'année » avec son rôle `owner`, Camille dans `members` (nom seulement), toutes les idées et réservations ; `myReservations`.
3. Chercher dans le fichier : `passwordHash`, `inviteToken`, `readPasswordHash`, `token`, `camille@example.test` → aucun résultat.
4. Mode avion → l'action est désactivée, avec le message hors ligne.
5. Site : `/compte` → Télécharger mes données → même contenu (seuls `exportedAt` diffère).
6. Six demandes en moins d'une heure → « trop de tentatives ».

## US4 : version, licences, contact

1. Mon compte → « Version 1.0.0 », comme `version` dans `mobile/app.config.ts`.
2. Licences → chaque dépendance directe de `mobile/package.json` est listée, avec son texte, même en mode avion.
3. Nous écrire → l'app e-mail s'ouvre avec l'adresse de contact des mentions légales (sur simulateur sans compte mail, vérifier l'URL `mailto:` dans les logs).

## Design

Pour Mon compte (section du bas), Supprimer mon compte, Mentions légales et Données personnelles : appliquer la grille de SC-005 de la 005 (couleurs, police, bordures, ombres, rayons, ordre des blocs, libellés), en français et en anglais, à côté de la capture `11-compte.png` et des pages `/mentions-legales` et `/donnees-personnelles` du site ouvertes sur téléphone.
