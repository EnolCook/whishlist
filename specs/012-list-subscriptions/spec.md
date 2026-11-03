# Feature Specification: S'abonner à des listes pour suivre leur contenu

**Feature Branch**: `012-list-subscriptions`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "On peut s'abonner à des listes pour suivre leur contenu" — Précisions du 2026-11-02 : site web et app mobile ; accès rapide dans son espace pour consulter le contenu à jour (sans notification ni pastille de non-lus) ; abonnement strictement privé (les membres de la liste ne voient ni qui suit leur liste ni le nombre d'abonnés).

## Contexte

Aujourd'hui, lorsqu'un proche reçoit le lien public d'une liste (`/l/[readToken]`), il peut la consulter et réserver des cadeaux, avec ou sans compte. Cependant, s'il veut revenir consulter la liste plus tard (pour voir les idées ajoutées ou réserver un cadeau à l'approche d'un événement), il doit retrouver le lien partagé initialement. Même connecté, l'écran « Mes listes » (sur le site et dans l'app mobile) n'affiche que les listes dont il est membre éditeur.

Cette fonctionnalité permet à une personne connectée de s'abonner à une liste partagée afin de la retrouver dans son espace (« Mes listes ») sur le site web comme dans l'app mobile, et d'en consulter le contenu public à tout moment. L'abonné reste un visiteur : il voit uniquement la vue publique (idées non archivées, filtres par catégorie / « qui » / budget, ses propres réservations), peut réserver ou annuler ses propres réservations, mais ne modifie rien et ne voit pas les réservations des autres. Pour préserver l'effet de surprise, l'abonnement est strictement privé : les membres de la liste ne savent ni qui suit leur liste ni combien de personnes y sont abonnées.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - S'abonner depuis une liste publique sur le site et la retrouver dans « Mes listes » (Priority: P1)

Sur le site web, une personne consulte une liste partagée via son lien public (`/l/[readToken]`). Elle clique sur « Suivre cette liste » (si elle n'est pas connectée, elle est invitée à se connecter ou créer un compte, puis revient sur la liste). Dès qu'elle suit la liste, elle la retrouve sur sa page « Mes listes » dans une section « Listes suivies », distincte de ses propres listes, et peut l'ouvrir en un clic pour consulter son contenu à jour ou réserver un cadeau.

**Why this priority**: C'est le parcours le plus direct lorsqu'on reçoit un lien de liste : un clic sur la page publique suffit à enregistrer la liste dans son compte pour ne plus jamais perdre le lien.

**Independent Test**: Sur la base de démo, ouvrir le lien public d'une liste dont le compte connecté n'est pas membre, cliquer sur « Suivre cette liste », puis ouvrir « Mes listes » : la liste apparaît dans « Listes suivies » et mène à la page publique `/l/[readToken]`.

**Acceptance Scenarios**:

1. **Given** une personne connectée qui consulte une liste publique déverrouillée dont elle n'est pas membre, **When** elle clique sur « Suivre cette liste », **Then** la liste est ajoutée à ses listes suivies et la page affiche l'état « Liste suivie » avec l'action « Ne plus suivre ».
2. **Given** une personne non connectée qui consulte une liste publique, **When** elle clique sur « Suivre cette liste », **Then** elle est dirigée vers la connexion (avec lien vers l'inscription) et ramenée vers la liste une fois connectée.
3. **Given** une personne connectée qui suit au moins une liste, **When** elle ouvre « Mes listes » sur le site, **Then** elle voit ses listes suivies dans une section « Listes suivies » (avec titre, sous-titre et illustration), séparée des listes dont elle est membre.
4. **Given** une personne déjà membre d'une liste, **When** elle consulte la page publique `/l/[readToken]` de cette liste, **Then** le bouton d'abonnement ne lui est pas proposé.

---

### User Story 2 - Suivre et consulter une liste partagée depuis l'espace « Mes listes » (App mobile et Site) (Priority: P2)

Depuis l'écran « Mes listes » (dans l'app mobile comme sur le site), une personne connectée peut ajouter une liste à suivre en collant son lien public (`/l/[readToken]` ou le jeton de lecture). Si la liste est protégée par un mot de passe de lecture, celui-ci lui est demandé. Dans l'app mobile, toucher une liste suivie ouvre sa vue publique complète (idées par catégorie, filtres « pour qui » et budget, réservation et annulation de ses propres réservations).

**Why this priority**: Dans l'app mobile, on ne navigue pas dans un navigateur web : coller le lien reçu par message et consulter la liste directement dans l'app est indispensable pour que les listes suivies y soient utiles.

**Independent Test**: Dans l'app mobile (et sur le site), ouvrir « Mes listes », ajouter une liste suivie en collant son lien public de démo, l'ouvrir dans l'app, parcourir ses idées et réserver un cadeau. Un parcours Maestro `012-us2` le vérifie.

**Acceptance Scenarios**:

1. **Given** une personne connectée sur « Mes listes » (site ou app mobile), **When** elle choisit « Suivre une liste » et colle l'adresse publique complète ou le jeton d'une liste existante non protégée, **Then** la liste s'ajoute à la section « Listes suivies ».
2. **Given** un lien vers une liste protégée par un mot de passe de lecture, **When** la personne tente de la suivre ou de l'ouvrir sans l'avoir déverrouillée, **Then** le mot de passe de lecture lui est demandé ; une fois le bon mot de passe saisi, la liste est suivie et accessible.
3. **Given** une liste suivie dans l'app mobile, **When** la personne la touche dans « Mes listes », **Then** elle consulte les idées disponibles groupées par catégorie, peut filtrer par personne et par budget, et peut réserver une idée (avec son nom et un petit mot optionnel) ou annuler sa propre réservation.
4. **Given** l'app mobile hors ligne après avoir déjà ouvert une liste suivie, **When** la personne rouvre cette liste suivie sans réseau, **Then** elle peut lire la dernière copie synchronisée de ses idées (les actions de réservation ou de désabonnement étant réservées au mode connecté ou signalées comme indisponibles hors ligne).
5. **Given** un lien invalide, inconnu, ou appartenant à une liste dont la personne est déjà membre, **When** elle valide l'ajout, **Then** un message explicite l'en informe et aucun abonnement n'est créé.

---

### User Story 3 - Se désabonner d'une liste suivie (Priority: P3)

Une personne qui ne souhaite plus suivre une liste peut choisir « Ne plus suivre » depuis la page de la liste suivie ou depuis ses listes suivies, sur le site comme dans l'app mobile. La liste disparaît de sa section « Listes suivies », mais les cadeaux qu'elle avait réservés sur cette liste restent réservés.

**Why this priority**: Permet de nettoyer son espace une fois un événement passé (Noël, anniversaire) sans annuler par erreur les cadeaux déjà promis.

**Independent Test**: Se désabonner d'une liste suivie sur laquelle on a réservé un cadeau : la liste disparaît de « Listes suivies », et la réservation demeure présente sur la liste. Un parcours Maestro `012-us3` le vérifie.

**Acceptance Scenarios**:

1. **Given** une personne abonnée à une liste, **When** elle active « Ne plus suivre » (avec confirmation si déclenché depuis la liste), **Then** l'abonnement est supprimé et la liste n'apparaît plus dans « Listes suivies ».
2. **Given** une personne qui a réservé un cadeau sur une liste suivie, **When** elle se désabonne de cette liste, **Then** sa réservation reste active et inchangée sur la liste.

---

### User Story 4 - Suivre une liste en scannant son QR code (App mobile) (Priority: P3)

Une personne à côté d'un proche qui lui montre l'écran « Partager » de sa liste (QR code du lien public) peut, depuis « Suivre une liste » dans l'app, scanner ce QR code au lieu de recopier le lien. La liste est suivie comme si le lien avait été collé : mot de passe demandé si la liste est protégée, puis ouverture de la liste.

**Why this priority**: Le QR code existe déjà côté propriétaire (écran « Partager » de l'app) ; le scanner depuis l'app évite de faire transiter le lien par une messagerie quand les deux personnes sont côte à côte.

**Independent Test**: Sur un téléphone réel, scanner le QR code de l'écran « Partager » d'une liste depuis « Suivre une liste » : la liste s'ouvre et figure dans « Listes suivies ». La caméra n'existe pas dans le simulateur : le parcours est exclu de Maestro et vérifié par un test d'écran (caméra simulée) et à la main ([quickstart.md § Parcours 4](quickstart.md#parcours-4--suivre-une-liste-en-scannant-son-qr-code-us4)).

**Acceptance Scenarios**:

1. **Given** une personne connectée sur « Suivre une liste », **When** elle scanne le QR code du lien public d'une liste, **Then** elle suit la liste et arrive sur sa vue, comme après avoir collé le lien.
2. **Given** un QR code qui n'est pas le lien d'une liste, **When** il est scanné, **Then** un message l'indique et le scan reprend, sans rien envoyer au serveur.
3. **Given** une liste protégée par un mot de passe de lecture, **When** son QR code est scanné, **Then** le titre de la liste et le champ mot de passe s'affichent, comme pour un lien collé.
4. **Given** une personne qui a refusé l'accès à la caméra, **When** elle choisit de scanner, **Then** un message explique comment l'autoriser dans les réglages, et coller le lien reste possible.

---

### Edge Cases

- **Confidentialité absolue vis-à-vis des membres** : les membres et le propriétaire d'une liste ne voient jamais qui suit leur liste ni combien de personnes la suivent (ni dans l'interface, ni dans l'API, ni dans l'export de leurs données).
- **Devenir membre d'une liste déjà suivie** : si un abonné accepte une invitation à rejoindre la liste comme membre (`/inviter/[token]`), son abonnement est automatiquement supprimé afin que la liste n'apparaisse que dans ses listes de membre, sans doublon.
- **Changement du mot de passe de lecture ou du lien public** :
  - Si un membre ajoute ou modifie le mot de passe de lecture de la liste, l'abonné existant doit saisir le nouveau mot de passe pour consulter à nouveau le contenu de la liste.
  - L'abonnement ne contourne jamais le contrôle d'accès par mot de passe de lecture.
- **Suppression de la liste ou du compte abonné** :
  - Si le propriétaire supprime la liste, tous les abonnements à cette liste sont supprimés automatiquement.
  - Si l'abonné supprime son compte, tous ses abonnements sont supprimés ; l'aperçu avant suppression et l'export des données du compte (`Télécharger mes données`) prennent en compte ses listes suivies.
- **Idempotence** : s'abonner à une liste que l'on suit déjà réussit sans créer de doublon.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Une personne connectée (avec un compte actif sans changement de mot de passe obligatoire) MUST pouvoir s'abonner à toute liste publique dont elle connaît le lien de lecture (`readToken`), à condition d'y avoir accès en lecture et de ne pas en être déjà membre.
- **FR-002**: Une personne connectée MUST pouvoir s'abonner soit directement depuis la page publique `/l/[readToken]` sur le site, soit en saisissant/collant un lien public (ou `readToken`) depuis son espace « Mes listes » (site et app mobile).
- **FR-003**: Si une liste est protégée par un mot de passe de lecture, le système MUST exiger un déverrouillage valide (mot de passe vérifié) avant d'autoriser la création de l'abonnement et lors de toute consultation ultérieure si le mot de passe a été ajouté ou modifié depuis.
- **FR-004**: Une personne connectée MUST pouvoir se désabonner à tout moment d'une liste qu'elle suit, sur le site comme dans l'app mobile, sans que cela n'affecte ses réservations sur cette liste.
- **FR-005**: L'écran « Mes listes » (site web et app mobile) MUST afficher les listes suivies dans une section dédiée « Listes suivies », distincte des listes dont l'utilisateur est membre, même lorsque l'utilisateur n'est membre d'aucune liste.
- **FR-006**: Consulter une liste suivie (sur le site ou dans l'app mobile) MUST exposer uniquement les données publiques de la liste : titre, sous-titre, illustration, thème, catégories, personnes (« qui »), idées non archivées disponibles ou réservées par l'abonné lui-même. Aucune réservation d'un tiers, idée archivée, liste des membres ou réglage privé MUST ne jamais être exposé à un abonné.
- **FR-007**: Dans l'app mobile, l'écran de détail d'une liste suivie MUST permettre de parcourir les idées par catégorie, de filtrer par « qui » et par budget, de réserver une idée disponible et d'annuler sa propre réservation.
- **FR-008**: L'abonnement MUST être strictement privé : aucune vue membre, route d'API ou export de données d'un membre de la liste ne doit révéler l'existence, le nombre ou l'identité des abonnés.
- **FR-009**: Lorsqu'un utilisateur rejoint une liste comme membre éditeur, tout abonnement existant de cet utilisateur à cette liste MUST être supprimé automatiquement dans la même opération.
- **FR-010**: La suppression d'une liste ou d'un compte utilisateur MUST supprimer en cascade les abonnements associés ; le fichier d'export des données personnelles du compte (`Télécharger mes données`) MUST inclure la liste des abonnements de l'utilisateur (titre de la liste, date d'abonnement, adresse publique).
- **FR-012**: Dans l'app mobile, l'écran « Suivre une liste » MUST permettre de scanner le QR code d'un lien public de liste avec la caméra, en plus de coller le lien. La caméra n'est demandée qu'au moment du scan ; un QR code qui n'est pas le lien d'une liste est refusé sur le téléphone. L'accès à la caméra est la seule permission ajoutée par la feature (Android : `CAMERA`, iOS : `NSCameraUsageDescription`, texte traduit).
- **FR-011**: Toutes les chaînes visibles nouvelles ou modifiées MUST être présentes dans les catalogues français (`locales/fr/`) et anglais (`locales/en/`), en respectant le vouvoiement et le lexique du produit.

### Key Entities

- **Subscription (Abonnement)** : Associe un utilisateur (`userId`) à une liste (`wishlistId`), avec un identifiant unique (`id`), la date d'abonnement (`createdAt`), et l'empreinte ou version du mot de passe de lecture déverrouillé le cas échéant afin d'invalider l'accès si le mot de passe de lecture de la liste change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Une personne connectée peut s'abonner à une liste depuis sa page publique en 1 clic, ou depuis « Mes listes » en collant son lien en moins de 15 secondes.
- **SC-002**: 100 % des accès d'un abonné (site web et API mobile) respectent l'isolation de la vue publique : zéro fuite des réservations d'autres personnes, des idées archivées ou des informations des membres.
- **SC-003**: 0 information sur les abonnés d'une liste n'est visible par les membres ou le propriétaire de cette liste.
- **SC-004**: Les parcours e2e Maestro de l'app mobile couvrent l'abonnement par lien, la consultation/réservation sur une liste suivie et le désabonnement, et tous les tests de domaine passent.

## Assumptions

- S'abonner sert à retrouver et consulter facilement les listes de ses proches dans son propre espace : aucun e-mail de notification ni pastille de « non-lu » n'est envoyé ou affiché lorsque des idées sont ajoutées.
- Consulter une liste ou réserver un cadeau sans compte reste inchangé et ne nécessite pas de s'abonner (conformément au principe II de la constitution).
- Les actions d'abonnement et de déverrouillage sont protégées par les limites de débit par IP habituelles du projet.
