# Feature Specification: Stockage des données dans une base embarquée

**Feature Branch**: `008-sqlite-storage`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Passer du fichier JSON à SQLite avec Drizzle : SQLite en mode WAL, en deux étapes. D'abord, readDocument et updateDocument fonctionnent sur SQLite et importent le JSON existant. Ensuite, les commandes font de vraies requêtes. C'est à faire avant la publication sur les stores."

## Contexte

Aujourd'hui, toutes les données (comptes, listes, idées, réservations, sessions de l'app mobile, demandes de réinitialisation) tiennent dans un seul fichier. Chaque page relit et décode tout le fichier ; chaque écriture, même une seule réservation, prend un verrou sur le fichier et le réécrit en entier. Les écritures passent donc une par une, et leur coût grandit avec le nombre total de listes, pas avec la taille de ce qui change.

L'app mobile va être publiée sur les stores. Le nombre de comptes et l'usage simultané (plusieurs personnes qui consultent ou réservent sur la même liste, l'app qui envoie sa file hors ligne au retour du réseau) vont augmenter. Avant cette publication, les données passent dans une base embarquée, toujours dans le volume de données du serveur, sans service à côté.

La migration se fait en deux étapes, livrées dans cet ordre :

1. **Changer de support sans rien changer d'autre.** Les points d'accès actuels au stockage (lire tout le document, le modifier sous verrou) gardent leur forme mais lisent et écrivent la base. Au premier démarrage, le fichier existant est importé. Le reste du code ne change pas.
2. **Lire et écrire seulement ce qui sert.** Les commandes (partagées par le site et l'API) et les pages demandent à la base seulement les données dont elles ont besoin, et n'écrivent que ce qui change.

Le choix technique est fixé par la demande : SQLite en mode WAL, avec Drizzle, ce qui laisse une porte de sortie vers une base serveur plus tard. Le plan le détaille ; la spec décrit ce qui doit rester vrai pour les personnes qui utilisent le site et l'app, et pour celle qui exploite le serveur.

Les « users » de cette feature sont la personne qui exploite le serveur (déploiement, sauvegarde, restauration) et la personne qui développe. Pour les personnes qui utilisent le site ou l'app, rien ne doit changer, sinon que tout reste rapide quand la base grandit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mettre à jour le serveur sans perdre une donnée (Priority: P1)

La personne qui exploite le serveur déploie la nouvelle version sur le volume de données existant. Au démarrage, l'application trouve l'ancien fichier, en importe tout le contenu dans la nouvelle base, et sert ensuite le site et l'API depuis la base. Les personnes qui utilisent le site et l'app ne voient aucune différence : mêmes listes, mêmes liens, mêmes réservations, et elles restent connectées.

**Why this priority**: C'est l'étape 1 de la demande et le seul passage risqué : une donnée perdue ou un lien cassé à ce moment touche des personnes réelles. Elle a de la valeur seule : la base est en place, la suite peut se faire par petites touches.

**Independent Test**: Sur une copie de la base de démo, démarrer l'ancienne version, se connecter sur le site et dans l'app, réserver une idée ; arrêter, démarrer la nouvelle version sur le même volume : les comptes, listes, idées, réservations et libellés sont tous présents, avec les mêmes nombres ; les liens de lecture, d'invitation et de réinitialisation en cours marchent encore ; la session du site et celle de l'app sont toujours ouvertes ; toutes les actions du site et de l'app marchent.

**Acceptance Scenarios**:

1. **Given** un volume de données avec l'ancien fichier et sans base, **When** la nouvelle version démarre, **Then** tout le contenu du fichier est importé dans la base avant que la première requête soit servie, et la base est utilisée dès lors.
2. **Given** l'import terminé, **When** on compare le contenu de la base et celui de l'ancien fichier, **Then** chaque enregistrement est présent avec les mêmes identifiants et les mêmes valeurs (après les compléments de champs anciens que l'application fait déjà à la lecture).
3. **Given** un lien de lecture, un lien d'invitation, un lien de réinitialisation en cours ou une session de l'app mobile émis avant la mise à jour, **When** il est utilisé après, **Then** il marche comme avant.
4. **Given** l'import terminé, **When** l'application redémarre, **Then** elle ne réimporte pas l'ancien fichier, même s'il est toujours là, et ne le modifie plus.
5. **Given** un volume vide (nouvelle installation), **When** l'application démarre, **Then** elle crée une base vide et marche comme une installation neuve d'aujourd'hui.

---

### User Story 2 - Tout continue de marcher pendant et après le changement de support (Priority: P1)

Après l'étape 1, chaque action du site et de l'API se comporte exactement comme avant : mêmes règles, mêmes messages, mêmes refus. Deux personnes qui confirment la même idée en même temps ne peuvent toujours pas réussir toutes les deux.

**Why this priority**: L'étape 1 n'a de valeur que si elle ne change aucun comportement. La réservation sans collision est un principe du produit et dépend directement de la façon dont les écritures sont protégées.

**Independent Test**: Lancer tous les tests existants du domaine, des commandes et de l'API sur la nouvelle base : ils passent sans changement de leurs attentes. Lancer la suite e2e de l'app mobile et le parcours manuel des `quickstart.md` sur la base de démo : même résultat qu'avant.

**Acceptance Scenarios**:

1. **Given** les tests existants, **When** ils s'exécutent sur la nouvelle base, **Then** ils passent tous, chacun sur une base temporaire qui lui est propre.
2. **Given** deux confirmations simultanées de la même idée, **When** elles arrivent ensemble, **Then** une seule réussit et l'autre reçoit le même refus qu'aujourd'hui.
3. **Given** une action qui échoue au milieu (erreur, refus d'une règle), **When** elle s'arrête, **Then** aucune de ses écritures n'est gardée : la base reste dans l'état d'avant l'action.
4. **Given** l'export des données d'un compte et la suppression d'un compte, **When** on les fait après la migration, **Then** ils donnent le même résultat qu'avant (même contenu exporté, mêmes listes transmises ou supprimées).

---

### User Story 3 - Sauvegarder et restaurer le serveur (Priority: P2)

La personne qui exploite le serveur sait comment faire une sauvegarde cohérente de la base pendant que l'application tourne, et comment la restaurer. La doc de déploiement le dit en quelques commandes.

**Why this priority**: Avec un fichier lisible, copier le volume suffisait. Avec une base, une copie naïve pendant une écriture peut donner une sauvegarde inutilisable. Sans procédure écrite, la première restauration se ferait à l'aveugle. Elle vient après les US1 et US2 parce qu'elle ne change rien au fonctionnement.

**Independent Test**: Suivre la doc : faire une sauvegarde pendant que l'application tourne et reçoit des réservations, arrêter l'application, restaurer la sauvegarde sur un volume neuf, redémarrer : les données sont celles du moment de la sauvegarde, et tout marche.

**Acceptance Scenarios**:

1. **Given** l'application en marche, **When** la personne suit la procédure de sauvegarde, **Then** elle obtient une copie cohérente sans arrêter le service.
2. **Given** une sauvegarde, **When** la personne suit la procédure de restauration, **Then** l'application redémarre sur les données de la sauvegarde.
3. **Given** la doc de déploiement, **When** la personne cherche quoi faire si la mise à jour se passe mal, **Then** elle trouve comment revenir à la version précédente avec l'ancien fichier, et sait que les changements faits depuis la mise à jour seront perdus.

---

### User Story 4 - Rester rapide quand la base grandit (Priority: P2)

C'est l'étape 2 de la demande. Ouvrir une liste, réserver une idée ou synchroniser l'app ne lit et n'écrit que les données de la liste et du compte concernés. Le temps de réponse ne dépend plus du nombre total de listes sur le serveur, et des écritures sur des listes différentes ne s'attendent plus les unes les autres plus que nécessaire.

**Why this priority**: C'est le gain attendu avant la publication sur les stores. Elle vient après l'étape 1, qui doit être déployée et confirmée d'abord, pour qu'une erreur de migration et une erreur de requête ne se mélangent pas.

**Independent Test**: Sur une base de démo agrandie (des milliers de comptes et de listes fictifs), mesurer le temps d'ouverture d'une liste, d'une réservation et d'une synchronisation de l'app, avant et après l'étape 2 : après l'étape 2, ces temps restent du même ordre qu'avec la base de démo normale. Tous les tests existants passent toujours.

**Acceptance Scenarios**:

1. **Given** une base de démo agrandie, **When** une personne ouvre une liste, **Then** le temps de réponse est du même ordre que sur la base de démo normale.
2. **Given** deux personnes qui agissent en même temps sur deux listes différentes, **When** leurs écritures arrivent ensemble, **Then** aucune n'échoue à cause de l'autre et aucune ne voit son attente grandir avec le nombre de listes.
3. **Given** une commande réécrite pour lire seulement ce qui sert, **When** ses tests s'exécutent, **Then** les mêmes droits d'accès, limites et refus sont vérifiés qu'avant (compte actif, membre de la liste, accès public, limite de débit).
4. **Given** l'étape 2 terminée, **When** on cherche dans le code un accès qui lit ou réécrit tout le document, **Then** il n'en reste aucun dans les commandes ni dans les pages ; ceux qui restent (import, export, outils de démo) sont nommés dans le plan.

---

### User Story 5 - Développer et faire des démos comme avant (Priority: P3)

La personne qui développe lance le site, la base de démo, les captures du guide et la suite e2e de l'app mobile avec les mêmes commandes qu'aujourd'hui, ou avec des commandes mises à jour dans le guide des agents. Les tests créent chacun leur base temporaire.

**Why this priority**: Sans elle, la migration casse le quotidien (démo, captures, e2e) sans que l'utilisateur final le voie. Elle se règle en même temps que les US1 et US4, mais se vérifie à part.

**Independent Test**: Suivre le guide des agents depuis un clone neuf : installation, base de démo, serveur de démo, captures, suite e2e de l'app mobile ; chaque commande marche et n'écrit que dans son propre emplacement.

**Acceptance Scenarios**:

1. **Given** la commande de création des données de démo, **When** elle s'exécute, **Then** elle produit une base de démo utilisable par le serveur de démo et par la suite e2e.
2. **Given** la suite e2e de l'app mobile, **When** elle remet la base de démo dans son état connu, **Then** elle le fait sur la nouvelle base, sans arrêter le serveur ou avec une étape documentée.
3. **Given** un test qui touche au stockage, **When** il s'exécute, **Then** il travaille sur une base temporaire et jamais sur la base de développement.

---

### Edge Cases

- **Ancien fichier illisible ou incomplet** (JSON invalide, collection manquante) : l'application refuse de démarrer avec un message qui le dit, et ne crée pas de base vide à la place ; l'ancien fichier n'est pas touché.
- **Import interrompu** (arrêt du conteneur, disque plein) : l'import est tout ou rien ; au démarrage suivant, il recommence depuis l'ancien fichier, sans doublon.
- **Données incohérentes dans l'ancien fichier** (idée dont la liste n'existe plus, réservation sur une idée supprimée, adresse e-mail en double) : l'import ne perd pas silencieusement de données ; soit il les garde telles quelles, soit il s'arrête en nommant les enregistrements fautifs. Le choix est fait au plan, mais aucune ligne ne disparaît sans être signalée.
- **Base et ancien fichier présents** : la base fait foi ; l'ancien fichier est ignoré.
- **Plusieurs processus** sur le même volume (serveur et script de démo, ou deux instances au démarrage) : un seul fait l'import ; les autres attendent ou échouent proprement, jamais deux imports.
- **Droits sur le volume** : la base et ses fichiers annexes sont créés dans le volume de données, lisibles et modifiables par le seul compte du conteneur, comme l'ancien fichier aujourd'hui.
- **Valeurs particulières** : dates, prix en centimes, textes avec emoji ou accents, listes vides de libellés, liens et images absents gardent exactement leur valeur après l'import.
- **Ordre d'affichage** : l'ordre des idées, des libellés et des listes reste le même qu'avant l'import.
- **Retour en arrière** : revenir à l'ancienne version reste possible avec l'ancien fichier, au prix des changements faits depuis ; ce n'est pas une synchronisation dans les deux sens.
- **Sessions et réinitialisations expirées** importées : elles restent refusées comme avant ; l'import ne les rend pas valides.
- **Limite de débit** : son état actuel peut repartir de zéro au redémarrage, comme aujourd'hui ; la migration ne change pas sa règle.

## Requirements *(mandatory)*

### Functional Requirements

**Étape 1 : changement de support**

- **FR-001**: Toutes les données aujourd'hui stockées dans le fichier (comptes, listes, adhésions, libellés, personnes, vues, idées, réservations, demandes de réinitialisation, sessions de l'app mobile) DOIVENT être stockées dans la base embarquée, dans le volume de données du serveur.
- **FR-002**: Au démarrage, si la base n'existe pas et que l'ancien fichier existe, l'application DOIT importer tout son contenu, en une seule opération tout ou rien, avant de servir une requête.
- **FR-003**: L'import DOIT garder les identifiants, jetons, empreintes de mot de passe, dates et valeurs de chaque enregistrement, et appliquer les mêmes compléments de champs anciens que la lecture actuelle.
- **FR-004**: Après l'import, l'application NE DOIT plus lire ni modifier l'ancien fichier, et NE DOIT PAS le réimporter.
- **FR-005**: Si l'ancien fichier est illisible ou incohérent, l'application DOIT refuser de démarrer avec un message explicite, sans créer de base et sans modifier le fichier.
- **FR-006**: À l'étape 1, les points d'accès actuels au stockage DOIVENT garder leur forme (lire tout le document, le modifier sous protection), pour que le reste du code ne change pas.
- **FR-007**: Chaque modification DOIT être atomique : toutes ses écritures sont gardées, ou aucune.
- **FR-008**: Deux modifications concurrentes NE DOIVENT PAS pouvoir confirmer la même idée deux fois, ni perdre l'écriture de l'autre.
- **FR-009**: La base DOIT permettre des lectures pendant une écriture sans qu'elles attendent la fin de celle-ci.
- **FR-010**: La base et ses fichiers annexes DOIVENT avoir les mêmes droits restreints que l'ancien fichier, et rester hors du dépôt.

**Étape 2 : requêtes ciblées**

- **FR-011**: Les commandes partagées par le site et l'API DOIVENT lire seulement les données de la liste, du compte ou du lien concernés, et écrire seulement ce qui change.
- **FR-012**: Les pages du site DOIVENT obtenir leurs données de la même façon ciblée, sans relire tout le document.
- **FR-013**: Les règles métier DOIVENT rester testées sans base réelle ou sur une base temporaire, avec les mêmes cas qu'aujourd'hui (validation, erreur, limite, droit d'accès).
- **FR-014**: Après l'étape 2, les seuls accès à tout le document DOIVENT être ceux qui en ont besoin par nature (import, outils de démo et de maintenance), listés dans le plan.

**Exploitation et développement**

- **FR-015**: La doc de déploiement DOIT décrire la mise à jour depuis l'ancien fichier, la sauvegarde à chaud, la restauration et le retour à la version précédente.
- **FR-016**: Les outils de démo (création des données, serveur de démo, captures du guide, remise à zéro de la suite e2e) DOIVENT marcher sur la nouvelle base ; le guide des agents et le README DOIVENT donner les commandes à jour.
- **FR-017**: Une variable d'environnement nouvelle ou modifiée (emplacement de la base) DOIT être documentée dans le README, `.env.example` et `deploy/compose.prod.yml`, et une installation existante DOIT marcher sans changer sa configuration.
- **FR-018**: Les tests qui touchent au stockage DOIVENT chacun créer leur base temporaire, jamais utiliser la base de développement.
- **FR-019**: Aucun comportement visible du site, de l'API ou de l'app mobile NE DOIT changer : mêmes réponses, mêmes messages, même contrat d'API.

### Key Entities

- **Ancien fichier** : le fichier de données actuel ; source de l'import unique, gardé tel quel ensuite comme trace et pour un éventuel retour en arrière.
- **Base embarquée** : le nouveau stockage, dans le volume de données ; contient les mêmes collections que l'ancien fichier, avec les mêmes identifiants et les mêmes liens entre elles (une idée appartient à une liste, une réservation à une idée, une adhésion relie un compte et une liste).
- **Import** : l'opération unique qui copie l'ancien fichier dans la base au premier démarrage ; réussit en entier ou ne laisse rien.
- **Sauvegarde** : une copie cohérente de la base faite pendant que l'application tourne, restaurable sur un volume neuf.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Après l'import de la base de démo et d'une copie anonymisée de la taille de la prod, 100 % des enregistrements de chaque collection sont présents, avec les mêmes nombres et les mêmes valeurs que dans l'ancien fichier.
- **SC-002**: 100 % des tests existants du domaine, des commandes, de l'API et de l'app mobile passent après chaque étape, sans changement de leurs attentes.
- **SC-003**: Aucune personne connectée avant la mise à jour (site ou app) n'a à se reconnecter après.
- **SC-004**: Sur 100 tentatives simultanées de confirmer la même idée, exactement une réussit.
- **SC-005**: Après l'étape 2, sur une base de démo agrandie à au moins 100 fois sa taille, ouvrir une liste, réserver une idée et synchroniser l'app prennent au plus deux fois le temps mesuré sur la base de démo normale.
- **SC-006**: Une personne qui n'a pas fait la migration peut, en suivant seulement la doc, sauvegarder la base à chaud et la restaurer sur un volume neuf en moins de 10 minutes.

## Assumptions

- Le choix technique (SQLite en mode WAL, Drizzle) vient de la demande. Il respecte la section hébergement de la constitution : la base est un fichier du volume `/data`, sans service annexe ni base managée.
- L'import est à sens unique : l'ancien fichier n'est plus écrit après la migration. Un retour à l'ancienne version perd les changements faits depuis ; c'est accepté parce que la mise à jour se vérifie juste après le déploiement.
- Les deux étapes sont livrées et déployées séparément, l'étape 1 d'abord ; l'étape 2 peut se faire commande par commande.
- Le contrat de l'API mobile ne change pas ; l'app mobile n'a pas à être mise à jour.
- L'état de la limite de débit reste en mémoire, comme aujourd'hui ; il n'entre pas dans la base.
- La base de démo et les données de test ne contiennent que des comptes fictifs `@example.test`. La mesure de taille « prod » se fait sur une copie anonymisée ou générée, jamais avec des données réelles dans le dépôt.
- Le passage futur à une base serveur n'est pas dans cette feature ; elle doit seulement ne pas l'empêcher.
