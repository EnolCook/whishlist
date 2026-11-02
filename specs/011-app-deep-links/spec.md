# Feature Specification: Liens qui ouvrent l'app

**Feature Branch**: `011-app-deep-links`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Pour gérer les mails de confirmation de compte, de récupération de mot de passe, d'invitation, de partage, etc, met en place le deeplinking => Tout lien doit ouvrir l'app si elle existe et effectuer les bonnes actions en fonction. Et sur la version web, si on ouvre depuis un téléphone, il faudra mettre en place une petite icone animée avec un téléphone. L'icone s'anime pendant 5 secondes max et arrête de s'animer quand on clique dessus ou au bout de 5 secondes. Quand on clique sur l'icone, ça ouvre une modale qui propose les liens / icones vers les apps android et ios."

## Contexte

Aujourd'hui, tous les liens que le service envoie ou fait partager ouvrent le site, même sur un téléphone où l'app est installée : confirmation de l'adresse, réinitialisation du mot de passe, changement d'adresse, invitation à rejoindre une liste, lien de connexion de l'e-mail « compte déjà existant », lien public d'une liste. La feature 010 l'a noté comme hors périmètre (« Ouvrir ces liens directement dans l'app est hors périmètre »). Une personne qui utilise l'app doit donc finir l'action sur le site, puis revenir dans l'app.

Cette feature ajoute deux choses :

1. **Les liens ouvrent l'app** : sur un téléphone où l'app est installée, toucher un de ces liens ouvre l'app sur le bon écran, qui fait l'action du lien (confirmer l'adresse, choisir un nouveau mot de passe, rejoindre la liste…). Sans l'app, le même lien ouvre le site, comme aujourd'hui. Les liens restent les mêmes adresses web : un lien ancien, déjà envoyé, marche aussi.
2. **L'invitation à installer l'app sur le site** : quand le site est consulté depuis un téléphone, une petite icône de téléphone apparaît. Elle s'anime pendant au plus 5 secondes pour attirer l'œil, puis s'arrête (ou dès qu'on la touche). La toucher ouvre une fenêtre qui propose l'app sur l'App Store et sur Google Play.

**Périmètre** : l'app mobile (iOS et Android), le site et les adresses des liens envoyés. Les liens vers des pages que l'app n'a pas (accueil, guide, FAQ, pages légales…) continuent d'ouvrir le site.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Les liens des e-mails de compte ouvrent l'app (Priority: P1)

Une personne a l'app sur son téléphone. Elle reçoit un e-mail du service : confirmation de son adresse, réinitialisation de son mot de passe, confirmation d'un changement d'adresse, ou « vous avez déjà un compte » avec un lien de connexion. Elle touche le lien. L'app s'ouvre directement sur l'écran qui correspond et fait l'action : l'adresse est confirmée, ou un formulaire lui demande son nouveau mot de passe, ou le changement d'adresse est appliqué, ou l'écran de connexion s'affiche. Le résultat est le même que sur le site, et l'app est à jour (le bandeau « confirmez votre adresse » disparaît, « Mon compte » montre la nouvelle adresse).

**Why this priority**: ce sont les e-mails qui interrompent le plus la personne : sans eux elle reste bloquée (adresse non confirmée, mot de passe oublié). Les finir dans l'app évite l'aller-retour par le navigateur, où elle n'est souvent pas connectée.

**Independent Test**: sur la base de démo, avec l'app installée sur un simulateur et l'envoi d'e-mail en mode développement, créer un compte dans l'app, ouvrir le lien de confirmation reçu : l'app s'ouvre, confirme l'adresse et le bandeau disparaît. Faire de même pour la réinitialisation du mot de passe (puis se connecter avec le nouveau) et pour le changement d'adresse. Sur un appareil sans l'app, le même lien ouvre le site. Un parcours Maestro `011-us1` ouvre ces liens dans l'app.

**Acceptance Scenarios**:

1. **Given** l'app installée et un compte non vérifié connecté dans l'app, **When** la personne ouvre le lien de confirmation de son adresse, **Then** l'app s'ouvre sur un écran qui confirme l'adresse, avec un bouton vers ses listes, et le bandeau de confirmation n'apparaît plus.
2. **Given** l'app installée et personne de connecté dans l'app, **When** la personne ouvre un lien de confirmation valide, **Then** l'adresse est confirmée et l'écran propose de se connecter.
3. **Given** l'app installée, **When** la personne ouvre un lien de réinitialisation valide, **Then** l'app affiche le formulaire du nouveau mot de passe (mêmes règles que sur le site) ; une fois enregistré, elle peut se connecter avec.
4. **Given** l'app installée et un changement d'adresse en attente, **When** la personne ouvre le lien reçu à la nouvelle adresse, **Then** l'app applique le changement, le confirme, et « Mon compte » affiche la nouvelle adresse.
5. **Given** l'app installée, **When** la personne ouvre le lien de connexion de l'e-mail « compte déjà existant », **Then** l'app ouvre l'écran de connexion (ou ses listes si elle est déjà connectée).
6. **Given** un lien expiré, déjà utilisé ou inconnu, **When** il est ouvert dans l'app, **Then** l'app affiche le même message que le site (lien plus valide) et, quand le site le propose, la même suite (demander un nouveau lien).
7. **Given** l'app absente du téléphone, ou un ordinateur, **When** la personne ouvre n'importe lequel de ces liens, **Then** le site s'ouvre et se comporte comme aujourd'hui.
8. **Given** l'app installée et connectée à un autre compte que celui du lien, **When** la personne ouvre un lien de confirmation d'adresse ou de changement d'adresse, **Then** l'action porte sur le compte du lien, comme sur le site, et l'app n'affiche pas l'adresse de ce compte en entier.

---

### User Story 2 - Le lien d'invitation fait rejoindre la liste dans l'app (Priority: P2)

Un membre invite un proche à rejoindre sa liste, par e-mail ou en lui envoyant le lien d'invitation. Le proche a l'app. Il touche le lien : l'app s'ouvre, lui présente la liste à rejoindre et lui propose de la rejoindre. S'il n'est pas connecté, l'app lui demande de se connecter ou de créer un compte, puis revient à l'invitation. Une fois membre, il arrive sur la liste dans l'app.

**Why this priority**: c'est l'autre lien qui demande un compte, donc celui que le site ne peut pas finir sans connexion. Il n'a de valeur que pour les personnes déjà équipées de l'app, d'où la priorité derrière l'US1.

**Independent Test**: sur la base de démo, créer un lien d'invitation pour une liste depuis le site, l'ouvrir sur le simulateur avec l'app connectée à un autre compte vérifié : la liste est proposée, la rejoindre l'affiche dans « Mes listes ». Recommencer déconnecté : la connexion est demandée, puis l'invitation reprend. Un parcours Maestro `011-us2` rejoue l'ouverture du lien et l'arrivée sur la liste.

**Acceptance Scenarios**:

1. **Given** l'app installée et connectée à un compte vérifié, **When** la personne ouvre un lien d'invitation valide, **Then** l'app affiche le nom de la liste et un bouton pour la rejoindre ; après l'avoir touché, elle est membre et la liste s'ouvre.
2. **Given** l'app installée et personne de connecté, **When** la personne ouvre un lien d'invitation, **Then** l'app lui propose de se connecter ou de créer un compte, puis reprend l'invitation sans qu'elle ait à rouvrir le lien.
3. **Given** un compte dont l'adresse n'est pas confirmée (quand la confirmation est exigée), **When** il ouvre un lien d'invitation dans l'app, **Then** l'app lui explique qu'il doit d'abord confirmer son adresse et propose de renvoyer le lien, comme le site.
4. **Given** une personne déjà membre de la liste, **When** elle ouvre le lien d'invitation, **Then** l'app ouvre directement la liste.
5. **Given** un lien d'invitation révoqué ou inconnu, **When** il est ouvert dans l'app, **Then** l'app affiche le même message que le site.

---

### User Story 3 - Proposer l'app depuis le site sur un téléphone (Priority: P2)

Une personne consulte le site depuis son téléphone, par exemple en ouvrant le lien public d'une liste. Une petite icône de téléphone apparaît dans l'interface. Elle s'anime à l'arrivée sur la page, pendant au plus 5 secondes, puis reste immobile. Si la personne la touche, l'animation s'arrête aussitôt et une fenêtre s'ouvre : elle présente l'app en une phrase et propose deux liens, avec leurs badges, vers l'App Store et vers Google Play. La fenêtre se ferme sans rien faire d'autre.

**Why this priority**: c'est la façon de faire connaître l'app aux personnes qui arrivent par le site. Elle est indépendante des liens de l'US1 et de l'US2 et peut être livrée seule.

**Independent Test**: ouvrir le site dans un navigateur à la taille d'un téléphone (et sur un vrai téléphone) : l'icône apparaît, s'anime, s'arrête au plus tard 5 secondes après ; la toucher pendant l'animation l'arrête et ouvre la fenêtre avec les deux liens, qui mènent aux fiches des stores. Sur un ordinateur, l'icône n'apparaît pas. Le site n'a pas de test e2e : ce parcours se vérifie à la main, décrit dans le `quickstart.md`.

**Acceptance Scenarios**:

1. **Given** le site ouvert sur un téléphone, **When** une page s'affiche, **Then** l'icône de téléphone est visible et s'anime.
2. **Given** l'icône qui s'anime, **When** 5 secondes passent sans action, **Then** l'animation s'arrête et l'icône reste visible, immobile.
3. **Given** l'icône qui s'anime, **When** la personne la touche, **Then** l'animation s'arrête tout de suite et la fenêtre des apps s'ouvre.
4. **Given** la fenêtre des apps ouverte, **When** la personne touche le badge App Store ou Google Play, **Then** la fiche de l'app s'ouvre sur ce store ; le badge du système du téléphone est présenté en premier.
5. **Given** la fenêtre ouverte, **When** la personne la ferme (bouton, geste ou touche Échap), **Then** elle revient à la page, sans autre changement.
6. **Given** le site ouvert sur un ordinateur ou une tablette, **When** une page s'affiche, **Then** l'icône n'apparaît pas.
7. **Given** la personne a demandé à son téléphone de réduire les animations, **When** la page s'affiche, **Then** l'icône apparaît sans s'animer.
8. **Given** l'app pas encore disponible sur l'un des stores, **When** la fenêtre s'ouvre, **Then** seul le badge du store disponible apparaît ; si aucun ne l'est, l'icône n'apparaît pas.

---

### User Story 4 - Le lien public d'une liste ouvre l'app, même sans compte (Priority: P3)

Un membre partage le lien public de sa liste (QR code, message, e-mail). Un proche qui a l'app touche le lien. L'app s'ouvre sur une vue invité de la liste, qu'il soit connecté ou non : il y retrouve ce que la page publique du site propose. Il consulte les idées et leur statut, filtre par catégorie, saisit le mot de passe de lecture si la liste en a un, et réserve une idée (« J'offre ») avec son nom et un petit mot, comme sur le site. Il peut annuler sa propre réservation tant que le site le permet. Si la personne est membre de la liste, l'app ouvre directement sa vue membre.

**Why this priority**: c'est le lien le plus partagé, mais il sert surtout des invités sans compte, qui ont rarement l'app. Il demande les écrans les plus nombreux (vue invité complète), d'où sa place après les liens de compte.

**Independent Test**: sur la base de démo, ouvrir le lien public d'une liste sur le simulateur, l'app déconnectée : la vue invité s'affiche, réserver une idée, constater depuis le compte d'un membre que l'idée est réservée, avec le nom et le petit mot. Recommencer avec une liste protégée (mot de passe demandé) et avec un compte membre (vue membre ouverte). Un parcours Maestro `011-us4` rejoue l'ouverture du lien et la réservation.

**Acceptance Scenarios**:

1. **Given** l'app installée et personne de connecté, **When** la personne ouvre le lien public d'une liste, **Then** l'app affiche la vue invité de la liste : titre, idées, catégories, statut réservé ou non, sans les actions d'un membre.
2. **Given** l'app connectée à un compte qui n'est pas membre de la liste, **When** il ouvre le lien public, **Then** l'app affiche la même vue invité ; une réservation faite ainsi est liée au compte, comme sur le site.
3. **Given** l'app connectée à un compte membre de la liste, **When** il ouvre le lien public, **Then** l'app ouvre la liste dans sa vue membre.
4. **Given** une liste protégée par un mot de passe de lecture, **When** le lien est ouvert dans l'app, **Then** l'app demande le mot de passe avant d'afficher la liste ; un mot de passe faux est refusé avec le message du site, et les essais sont limités comme sur le site. Une fois déverrouillée, la liste le reste sur ce téléphone aussi longtemps que sur le site.
5. **Given** la vue invité, **When** la personne réserve une idée disponible avec son nom et un petit mot facultatif, **Then** l'idée n'est plus proposable, ni dans l'app ni sur le site, et les membres voient le nom et le petit mot dans les réservations de la liste, comme pour une réservation faite sur le site.
6. **Given** deux personnes qui réservent la même idée presque en même temps (l'une dans l'app, l'autre sur le site), **When** la seconde confirme, **Then** sa réservation est refusée avec le message du site, et l'idée reste à la première.
7. **Given** une réservation faite dans l'app, **When** la personne veut l'annuler, **Then** l'app le lui permet dans les mêmes conditions que le site (réservation liée à son compte, ou faite depuis ce téléphone).
8. **Given** un lien public inconnu, ou d'une liste supprimée, **When** il est ouvert dans l'app, **Then** l'app affiche le même message que le site (liste introuvable).
9. **Given** l'app absente, **When** une personne ouvre le lien public, **Then** le site s'ouvre comme aujourd'hui, y compris pour une liste protégée.
10. **Given** la vue invité ouverte hors ligne, **When** la personne tente de réserver, **Then** l'app affiche l'erreur réseau habituelle ; la réservation ne passe pas par la file hors ligne, pour ne pas confirmer une idée que quelqu'un d'autre aurait prise.

---

### Edge Cases

- **Lien vers une page que l'app n'a pas** (accueil, guide, FAQ, mentions légales, export des données) : le site s'ouvre, même si l'app est installée.
- **Langue** : les liens portent la langue de l'e-mail. L'app affiche l'écran dans sa propre langue, celle du téléphone ; le résultat de l'action ne dépend pas de la langue.
- **Lien ouvert alors que l'app est déjà ouverte sur un autre écran**, ou au milieu d'une saisie : l'app passe à l'écran du lien ; le retour ramène à l'écran précédent. Une idée en cours de saisie n'est pas enregistrée en douce, comme lorsqu'on quitte l'écran soi-même.
- **App hors ligne** : confirmer une adresse, réinitialiser un mot de passe, appliquer un changement d'adresse et rejoindre une liste demandent une connexion. L'app affiche l'erreur réseau habituelle et propose de réessayer ; ces actions ne passent pas par la file hors ligne.
- **Changement de mot de passe imposé** à la connexion : il passe avant l'écran du lien, puis l'app reprend le lien.
- **Lien ouvert depuis une application qui affiche les pages dans son propre navigateur** (messagerie, réseau social) : le téléphone peut ne pas ouvrir l'app. Le site s'ouvre alors et reste utilisable, avec l'icône de l'US3.
- **Liens d'un serveur de démo ou de développement** : seuls les liens du serveur de production ouvrent l'app publiée. Les builds de développement ouvrent les liens de leur serveur, pour les tests.
- **Ancienne version de l'app**, installée avant cette feature : le lien ouvre le site, comme aujourd'hui.
- **Lien de réinitialisation ouvert dans l'app connectée à un autre compte** : la réinitialisation porte sur le compte du lien ; la session ouverte dans l'app n'est pas modifiée.
- **Icône sur le site** : elle ne cache ni le contenu ni les boutons de la page, et n'apparaît pas en double. Elle a un nom lisible par les lecteurs d'écran.

## Requirements *(mandatory)*

### Functional Requirements

**Ouverture des liens dans l'app**

- **FR-001**: Sur un téléphone où l'app (dans une version qui gère cette feature) est installée, les liens du service vers une page que l'app sait traiter DOIVENT ouvrir l'app plutôt que le navigateur, pour iOS et Android.
- **FR-002**: Les liens DOIVENT rester des adresses web du site : le même lien ouvre l'app quand elle est installée, le site sinon. Les liens déjà envoyés avant la feature DOIVENT être traités de la même façon.
- **FR-003**: Les liens vers une page que l'app n'a pas DOIVENT continuer d'ouvrir le site.
- **FR-004**: L'app DOIT traiter au moins ces liens : confirmation de l'adresse, réinitialisation du mot de passe, confirmation d'un changement d'adresse, connexion, invitation à rejoindre une liste.
- **FR-005**: Pour chaque lien, l'app DOIT faire la même action que le site, avec les mêmes règles et les mêmes messages d'erreur (lien expiré, déjà utilisé, inconnu, révoqué, adresse non confirmée, limite de débit).
- **FR-006**: Quand l'action demande un compte connecté (invitation), l'app DOIT faire passer par la connexion ou l'inscription, puis reprendre l'action du lien sans qu'on ait à le rouvrir.
- **FR-007**: Après l'action, l'app DOIT afficher son nouvel état (adresse confirmée, nouvelle adresse, liste rejointe) sans redémarrage.
- **FR-008**: Les actions déclenchées par un lien DOIVENT passer par les mêmes contrôles que sur le site (jeton à usage unique, droits, limites de débit) ; ouvrir un lien dans l'app ne DOIT donner aucun droit de plus.
- **FR-009**: Les jetons portés par les liens ne DOIVENT pas être écrits en clair dans les journaux de l'app ni du serveur en production.
- **FR-010**: Le lien public d'une liste DOIT ouvrir dans l'app une vue invité, accessible sans compte, qui offre ce que la page publique du site offre : consultation des idées et de leur statut, filtre par catégorie, déverrouillage par le mot de passe de lecture, réservation avec un nom et un petit mot, annulation de sa propre réservation, choix d'une idée ou d'une catégorie sur la page « Je veux offrir ». Un membre de la liste DOIT arriver sur sa vue membre.
- **FR-010b**: La vue invité NE DOIT offrir aucune action réservée aux membres (modifier, inviter, annuler la réservation d'un autre) et DOIT respecter les règles de réservation sans collision : une idée réservée n'est plus proposable, et une réservation n'est jamais mise en attente hors ligne.

**Icône de l'app sur le site**

- **FR-011**: Le site DOIT afficher une icône de téléphone sur chaque page quand il est consulté depuis un téléphone (iOS ou Android), et pas sur un ordinateur ni une tablette.
- **FR-012**: L'icône DOIT s'animer à l'affichage de la page pendant au plus 5 secondes, puis s'arrêter ; elle DOIT s'arrêter immédiatement quand on la touche. Elle ne DOIT pas s'animer quand le téléphone demande de réduire les animations.
- **FR-013**: Toucher l'icône DOIT ouvrir une fenêtre qui présente l'app et propose les liens vers ses fiches sur l'App Store et sur Google Play, avec les badges officiels de chaque store, celui du système du téléphone en premier.
- **FR-014**: La fenêtre DOIT pouvoir se fermer par un bouton, par un geste hors de la fenêtre et au clavier, et être utilisable avec un lecteur d'écran.
- **FR-015**: Un store pour lequel l'app n'a pas de fiche publique DOIT être absent de la fenêtre ; sans aucun store disponible, l'icône NE DOIT PAS apparaître. Les adresses des fiches sont un réglage du serveur, optionnel.

**Commun**

- **FR-016**: Tous les textes ajoutés (écrans de l'app, icône, fenêtre) DOIVENT exister en français et en anglais, en vouvoyant en français.
- **FR-017**: Le contrat de l'API DOIT décrire toute opération ajoutée pour que l'app fasse les actions des liens (par exemple confirmer une adresse ou réinitialiser un mot de passe à partir du jeton du lien).

### Key Entities

- **Lien du service** : une adresse web du site qui porte une action (confirmer, réinitialiser, rejoindre…) et souvent un jeton secret. Il ne change pas de forme ; il devient seulement reconnu par l'app.
- **Fiche de l'app sur un store** : l'adresse publique de l'app sur l'App Store ou Google Play, présentée dans la fenêtre du site quand elle existe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sur un téléphone avec l'app installée, 100 % des liens listés en FR-004 ouvrent l'app sur le bon écran, sur iOS et sur Android.
- **SC-002**: Une personne qui reçoit l'e-mail de confirmation dans l'app confirme son adresse en un seul toucher sur le lien, sans passer par le navigateur ni se reconnecter.
- **SC-003**: Sans l'app, 100 % des liens ouvrent le site et donnent le même résultat qu'avant la feature.
- **SC-004**: Sur le site consulté depuis un téléphone, l'animation de l'icône ne dure jamais plus de 5 secondes.
- **SC-005**: Depuis le site sur un téléphone, une personne arrive sur la fiche de l'app de son store en deux touchers (l'icône, puis le badge).
- **SC-006**: Une personne sans compte réserve une idée dans l'app, depuis le lien public, en moins d'une minute, et aucune idée n'est jamais réservée deux fois, que les réservations viennent de l'app ou du site.

## Assumptions

- Les liens gardent leur adresse actuelle sur le domaine de production ; seule l'app publiée, signée pour ce domaine, les ouvre. Le domaine de production déclare publiquement quelles adresses l'app peut ouvrir, comme le demandent iOS et Android.
- L'installation différée (installer l'app depuis un lien puis retrouver l'action du lien au premier lancement) est hors périmètre : après installation, la personne rouvre le lien ou finit l'action sur le site.
- L'icône du site ne détecte pas si l'app est déjà installée (un site ne peut pas le savoir de façon fiable) : elle apparaît sur tout téléphone.
- L'icône s'anime à chaque page affichée ; elle n'a pas de bouton pour la masquer définitivement. Ce choix pourra être revu si elle gêne.
- Les fiches des stores ne sont pas encore toutes publiques (App Store en attente de sortie, Google Play en test fermé) : leurs adresses se règlent au déploiement, et l'icône reste absente tant qu'aucune n'est réglée.
- Les invitations, la réinitialisation, la confirmation et le changement d'adresse fonctionnent déjà sur le site et, pour une partie, par l'API (features 004, 006 et 010) : cette feature ajoute dans l'app les écrans qui les finissent, sans changer leurs règles.
- La vue invité de l'US4 élargit le périmètre de l'app fixé par la feature 005 (« l'app sert les membres ; consulter et réserver en invité restent sur le site »). L'API permet déjà la lecture publique, le déverrouillage et la réservation sans compte (feature 004) ; la vue invité de l'app s'appuie dessus. Le partage depuis l'app (QR code, lien) ne change pas.
- Le principe II de la constitution (lecture et réservation sans compte) s'applique à l'app comme au site : la vue invité ne demande jamais de compte.
- Le principe V de la constitution (« un mécanisme ne s'ajoute que s'il sert à créer, partager ou lire une liste ») est respecté : ouvrir dans l'app les liens d'invitation et de partage sert le partage, et les liens de compte servent l'accès à ses listes.
