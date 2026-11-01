# Feature Specification: Cartes repliables sur l'écran de compte de l'app

**Feature Branch**: `009-account-cards-expand`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Animations des cards sur la page de compte : la carte « Profil » n'affiche au départ que son en-tête (titre et description), de même pour la carte « Modifier le mot de passe ». Quand on clique sur la card, une animation la « déplie » pour révéler son contenu (formulaire)." Précisions : seulement l'app mobile ; la carte « Vos données et informations » aussi (ajout du 2026-11-01, US3) ; les catégories repliables de l'onglet Idées prennent la même animation (ajout du 2026-11-01, US4).

## Contexte

L'écran « Mon compte » de l'app mobile empile ses cartes ouvertes : le profil (nom affiché, adresse de connexion), le changement de mot de passe, puis les données et informations, la déconnexion et la suppression du compte. Les deux formulaires occupent l'essentiel de la hauteur alors qu'on s'en sert rarement, et repoussent le reste de l'écran hors de vue.

Avec cette feature, les cartes « Profil », « Modifier le mot de passe » et « Vos données et informations » s'affichent repliées : seul leur en-tête est visible (titre, et description quand la carte en a une). Un appui sur l'en-tête déplie la carte avec une animation qui révèle le formulaire ; un nouvel appui la replie.

**Périmètre** : l'app mobile seulement. La page « Mon compte » du site ne change pas. C'est un écart assumé avec la règle « l'app reste semblable au site » : l'apparence des cartes reste la même, seul leur comportement diffère.

Les boutons du bas (déconnexion, suppression du compte) ne changent pas. Le changement de mot de passe imposé à la connexion passe par un écran à part, qui n'est pas concerné.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Déplier la carte Profil pour changer son nom (Priority: P1)

Une personne connectée ouvre « Mon compte » dans l'app. La carte « Profil » montre seulement « Profil » et « Votre nom et votre adresse de connexion. », avec un signe qui indique qu'elle se déplie. Elle touche la carte : celle-ci s'agrandit en douceur et révèle le nom affiché, l'adresse de connexion et le bouton d'enregistrement. Elle change son nom, enregistre, et voit la confirmation dans la carte, qui reste ouverte.

**Why this priority**: c'est la carte en haut de l'écran ; la replier rend visible le reste de l'écran et porte à elle seule la valeur de la feature.

**Independent Test**: sur la base de démo, ouvrir « Mon compte », vérifier que la carte Profil est repliée, la déplier, enregistrer un nouveau nom, vérifier la confirmation ; la replier. Un parcours Maestro `009-us1` le rejoue.

**Acceptance Scenarios**:

1. **Given** une personne connectée, **When** elle ouvre « Mon compte », **Then** la carte Profil n'affiche que son titre, sa description et l'indicateur de dépliage ; aucun champ n'est visible.
2. **Given** la carte Profil repliée, **When** la personne touche n'importe où sur l'en-tête de la carte, **Then** la carte se déplie avec une animation et le formulaire devient visible et utilisable.
3. **Given** la carte Profil dépliée, **When** la personne touche de nouveau l'en-tête, **Then** la carte se replie avec une animation et le formulaire disparaît.
4. **Given** la carte Profil dépliée et un nom modifié, **When** la personne enregistre, **Then** la carte reste dépliée et affiche la confirmation (ou l'erreur).
5. **Given** un lecteur d'écran actif (VoiceOver, TalkBack), **When** le focus arrive sur l'en-tête, **Then** il est annoncé comme un bouton avec son état « replié » ou « déplié », et l'activer change cet état.

---

### User Story 2 - Déplier la carte Mot de passe (Priority: P2)

La carte « Modifier le mot de passe » se comporte comme la carte Profil : repliée au départ, elle n'affiche que son titre ; un appui la déplie et révèle les trois champs et le bouton.

**Why this priority**: même mécanique que la story 1, appliquée à une seconde carte.

**Independent Test**: ouvrir « Mon compte », déplier la carte Mot de passe, changer le mot de passe, vérifier le message de succès dans la carte dépliée. Un parcours Maestro `009-us2` le rejoue.

**Acceptance Scenarios**:

1. **Given** une personne connectée, **When** elle ouvre « Mon compte », **Then** la carte « Modifier le mot de passe » n'affiche que son titre et l'indicateur de dépliage.
2. **Given** la carte repliée, **When** la personne touche son en-tête, **Then** elle se déplie avec une animation et révèle les champs.
3. **Given** la carte dépliée, **When** la personne envoie le formulaire, **Then** la carte reste dépliée et affiche le succès ou l'erreur.

---

### User Story 3 - Déplier la carte Données et informations (Priority: P3)

La carte « Vos données et informations » se comporte comme les deux autres : repliée au départ, elle n'affiche que son titre et « Mentions légales, données personnelles, et une copie de vos données. » ; un appui la déplie et révèle les liens (mentions légales, données personnelles, téléchargement des données, licences, nous écrire) et la version de l'app.

**Why this priority**: même mécanique, sur la dernière carte de l'écran ; les boutons de déconnexion et de suppression remontent dans le premier écran.

**Independent Test**: ouvrir « Mon compte », vérifier que la carte est repliée, la déplier, ouvrir les mentions légales, revenir : la carte est toujours dépliée. Un parcours Maestro `009-us3` le rejoue.

**Acceptance Scenarios**:

1. **Given** une personne connectée, **When** elle ouvre « Mon compte », **Then** la carte « Vos données et informations » n'affiche que son titre, sa description et l'indicateur de dépliage.
2. **Given** la carte repliée, **When** la personne touche son en-tête, **Then** elle se déplie avec une animation et révèle les liens et la version.
3. **Given** la carte dépliée, **When** la personne ouvre une page (mentions légales, données personnelles, licences) puis revient, **Then** la carte est toujours dépliée.
4. **Given** l'app hors ligne, **When** la personne déplie la carte, **Then** le téléchargement des données reste désactivé et les pages légales restent ouvertes.

---

### User Story 4 - Déplier une catégorie d'idées avec la même animation (Priority: P4)

Sur l'onglet Idées d'une liste, les catégories sont déjà repliables (en-tête : flèches d'ordre, nom, nombre d'idées, chevron), mais elles s'ouvrent d'un coup. Elles prennent la même animation que les cartes du compte : la catégorie s'agrandit en douceur et révèle ses idées, le chevron pivote ; un nouvel appui la replie de la même façon.

Les sections repliables de l'écran des licences (nom du logiciel, puis texte de la licence) prennent la même animation.

**Why this priority**: même geste, même rendu partout dans l'app ; aucune nouvelle fonction.

**Independent Test**: ouvrir la liste de démo, toucher « Maison » : la catégorie se déplie avec l'animation et montre « Lampe de lecture » ; la toucher de nouveau la replie. Un parcours Maestro `009-us4` le rejoue.

**Acceptance Scenarios**:

1. **Given** l'onglet Idées d'une liste, **When** il s'affiche, **Then** les catégories sont repliées, comme aujourd'hui.
2. **Given** une catégorie repliée, **When** la personne touche son en-tête, **Then** elle se déplie avec l'animation des cartes du compte (même durée, chevron qui pivote, réglage « réduire les animations » respecté).
3. **Given** une catégorie dépliée, **When** la personne touche son en-tête, **Then** elle se replie avec l'animation ; les autres catégories gardent leur état.
4. **Given** une catégorie repliée, **Then** ses idées ne sont ni lues par un lecteur d'écran ni touchables (elles ne sont montées qu'une fois la catégorie dépliée, ce qui garde une longue liste légère) ; les flèches d'ordre restent utilisables.

---

### Edge Cases

- **Les cartes sont indépendantes** : déplier l'une ne replie pas les autres ; toutes peuvent être ouvertes en même temps.
- **Saisie en cours** : replier une carte puis la redéplier sans quitter l'écran conserve ce qui a été saisi.
- **Clavier ouvert** : replier une carte dont un champ a le focus ferme le clavier.
- **Préférence « réduire les animations »** de l'appareil : la carte s'ouvre et se ferme sans mouvement de hauteur, avec le même comportement replié / déplié.
- **Appuis rapides répétés** : la carte finit toujours dans l'état du dernier appui, sans rester à mi-hauteur ni sauter.
- **Appui dans le formulaire déplié** : toucher un champ ou le bouton ne replie pas la carte ; seul l'en-tête la replie.
- **Hors ligne** : les cartes se déplient et se replient normalement ; ce qui est désactivé hors ligne aujourd'hui le reste.
- **Écran de compte rouvert** : chaque ouverture de l'écran repart avec les trois cartes repliées ; revenir d'une page ouverte depuis l'écran (mentions légales…) n'est pas une réouverture : les cartes gardent leur état.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sur l'écran « Mon compte » de l'app, les cartes « Profil », « Modifier le mot de passe » et « Vos données et informations » MUST s'afficher repliées par défaut : seuls leur titre, leur description éventuelle et un indicateur de dépliage sont visibles.
- **FR-002**: Un appui sur l'en-tête d'une carte repliable MUST la déplier ; un nouvel appui sur l'en-tête MUST la replier.
- **FR-003**: Le passage replié ↔ déplié MUST être animé (la carte s'agrandit ou se réduit progressivement, le contenu apparaît ou disparaît), en moins d'une demi-seconde, et les éléments situés en dessous suivent sans saut.
- **FR-004**: Quand l'appareil demande de réduire les animations, le passage MUST se faire sans mouvement de hauteur.
- **FR-005**: L'en-tête MUST être exposé aux lecteurs d'écran comme un bouton avec son état replié / déplié.
- **FR-006**: Le contenu d'une carte repliée MUST ne pas être lu par un lecteur d'écran ni atteignable.
- **FR-007**: Après l'envoi d'un formulaire, la carte MUST rester dépliée pour montrer le succès ou l'erreur.
- **FR-008**: L'indicateur de dépliage MUST changer d'apparence selon l'état (par exemple un chevron qui pivote).
- **FR-009**: L'apparence des cartes (bordure, ombre, typographie) MUST rester celle des autres cartes de l'app ; seul le contenu se replie.
- **FR-010**: Le reste de l'écran (déconnexion, suppression du compte), l'écran de changement de mot de passe imposé et la page « Mon compte » du site MUST rester inchangés.
- **FR-011**: L'en-tête et l'indicateur MUST avoir un identifiant de test stable pour les parcours e2e (convention `account.<élément>`).
- **FR-012**: Les catégories de l'onglet Idées et les sections de l'écran des licences MUST se déplier et se replier avec la même animation et les mêmes règles (FR-003 à FR-006, FR-008) que les cartes repliables du compte.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: À l'ouverture de « Mon compte » sur un téléphone de taille courante, les trois cartes et le bouton de déconnexion tiennent dans le premier écran, sans défiler.
- **SC-002**: Changer son nom ou son mot de passe demande au plus un appui de plus qu'aujourd'hui.
- **SC-003**: L'animation de dépliage dure moins de 0,5 seconde et reste fluide sur iOS et Android.
- **SC-004**: Avec VoiceOver ou TalkBack, une personne déplie la carte, remplit le formulaire et entend l'état « replié » / « déplié ».
- **SC-005**: Avec la préférence « réduire les animations », aucune animation de hauteur n'est jouée.
- **SC-006**: Les parcours Maestro existants qui passent par l'écran de compte restent verts, et chaque story a son parcours.

## Assumptions

- L'état replié / déplié n'est pas mémorisé d'une ouverture de l'écran à l'autre.
- Toute la surface de l'en-tête réagit à l'appui, pas seulement l'indicateur.
- Les textes existants (titres, descriptions) suffisent ; seul un libellé accessible pour l'indicateur (« Déplier » / « Replier ») est à ajouter, en français et en anglais (namespace de l'app).
- La carte Mot de passe n'a pas de description aujourd'hui ; elle n'en reçoit pas.
- Pas de nouvelle donnée, ni règle métier, ni changement d'API ou du site : la feature ne touche que l'affichage de l'écran de compte de l'app.
- Un composant de carte repliable, s'il est créé, vit dans les composants d'interface de l'app et pourra servir à d'autres écrans plus tard ; cette feature ne l'applique qu'aux trois cartes du compte.
