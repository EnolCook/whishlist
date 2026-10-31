# Feature Specification: Suite de tests de bout en bout pour l'app mobile

**Feature Branch**: `007-mobile-e2e-maestro`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Suite de tests e2e Maestro pour l'app mobile"

## Contexte

L'app mobile (features 005 et 006) a des tests automatiques sur ses composants et sa logique, mais ses parcours complets (se connecter, créer une liste, la remplir, la partager, continuer sans réseau, supprimer son compte) ne se vérifient qu'à la main, en suivant les `quickstart.md` des features sur un simulateur. Pendant la 005, des parcours automatisés jetables ont été écrits pour aller plus vite : ils ne sont pas versionnés, dépendent les uns des autres (l'un suppose que le précédent a laissé l'app connectée ou une idée créée) et cassent dès qu'on les lance seuls ou dans un autre ordre.

L'app va être publiée sur les stores. Avant chaque version, il faut pouvoir confirmer en quelques minutes, sans tout refaire à la main, que les parcours principaux marchent encore sur iOS et sur Android. Cette feature ajoute une suite de parcours automatisés versionnée avec l'app, que la personne qui développe lance d'une seule commande sur un simulateur ou un émulateur, contre le serveur local et la base de démo.

Le « user » de cette feature est la personne qui développe et publie l'app.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lancer toute la suite d'une commande (Priority: P1)

Avant une version, la personne qui développe lance une seule commande documentée. La suite repart d'une base de démo connue, joue tous les parcours sur le simulateur ou l'émulateur ouvert, et finit par un résumé : quels parcours ont réussi, lesquels ont échoué.

**Why this priority**: C'est la raison d'être de la feature : remplacer une vérification manuelle longue par une commande. Sans elle, les parcours restent des fichiers qu'on ne lance pas.

**Independent Test**: Sur une machine où le serveur local et l'app tournent, lancer la commande : tous les parcours s'exécutent, le résumé liste chacun avec son résultat, et la commande rend un code d'échec si au moins un parcours a échoué.

**Acceptance Scenarios**:

1. **Given** le serveur local démarré sur la base de démo et l'app installée sur un simulateur iOS, **When** la personne lance la commande, **Then** tous les parcours s'exécutent et le résumé indique le résultat de chacun.
2. **Given** la même chose sur un émulateur Android, **When** elle lance la même commande, **Then** les mêmes parcours s'exécutent, sans parcours propre à une plateforme sauf ceux listés comme tels.
3. **Given** un parcours qui échoue, **When** la suite se termine, **Then** les autres parcours ont quand même été joués, et la commande se termine en échec.
4. **Given** une base de démo modifiée par une exécution précédente ou par un essai à la main, **When** la personne relance la suite, **Then** les résultats sont les mêmes qu'avec une base neuve.

---

### User Story 2 - Lancer un parcours seul (Priority: P1)

En corrigeant un écran, la personne relance seulement le parcours qui le couvre. Ce parcours prépare lui-même ce dont il a besoin (compte connecté, liste existante) et ne dépend d'aucun autre parcours.

**Why this priority**: C'est ce qui manque aux parcours jetables actuels. Un parcours qui ne tourne que derrière un autre est inutilisable pour corriger un écran, et toute la suite devient fragile à l'ordre.

**Independent Test**: Lancer chaque parcours seul, puis tous dans un ordre différent : chacun donne le même résultat que dans la suite complète.

**Acceptance Scenarios**:

1. **Given** l'app fraîchement installée (aucun compte connecté), **When** la personne lance un parcours qui suppose un compte connecté, **Then** le parcours se connecte lui-même avec un compte de démo, par la même étape partagée que les autres parcours.
2. **Given** un parcours qui modifie des données (crée une liste, ajoute une idée, supprime un compte), **When** il s'exécute, **Then** il ne laisse rien dont un autre parcours dépend : les parcours destructifs utilisent un compte ou une liste qu'ils créent eux-mêmes.
3. **Given** un parcours lancé deux fois de suite, **When** la seconde exécution se termine, **Then** elle réussit aussi (les noms créés ne se heurtent pas à ceux de la première exécution).

---

### User Story 3 - Couvrir les parcours des features 005 et 006 (Priority: P2)

Chaque user story de l'app mobile (005 : connexion et compte, mes listes, remplir une liste, partager, hors ligne ; 006 : supprimer son compte, pages légales, récupérer ses données, version et licences) a au moins un parcours automatisé qui suit son « Independent Test », pour la partie qui se joue dans l'app.

**Why this priority**: La suite n'a de valeur que si elle couvre ce qui compte. Elle vient après les US1 et US2 parce qu'un premier parcours (connexion) suffit à valider la mécanique ; les autres s'ajoutent un par un.

**Independent Test**: Comparer la liste des parcours avec les user stories des specs 005 et 006 : chaque story a son parcours, ou figure dans la liste des exclusions avec la raison et le renvoi au `quickstart.md` qui reste manuel.

**Acceptance Scenarios**:

1. **Given** le parcours « connexion et compte », **When** il s'exécute, **Then** il vérifie le refus d'un mauvais mot de passe sans dire lequel des deux champs est faux, la connexion réussie, la création d'un compte et la déconnexion.
2. **Given** le parcours « remplir une liste », **When** il s'exécute, **Then** il ajoute une idée, vérifie le message d'un prix invalide sans perte des autres champs, modifie, archive puis supprime l'idée avec confirmation.
3. **Given** le parcours « hors ligne », **When** il s'exécute sur une plateforme où la suite peut couper le réseau de l'app, **Then** il vérifie le bandeau hors ligne, les changements marqués « en attente », leur conservation après redémarrage de l'app et leur envoi au retour du réseau.
4. **Given** le parcours « supprimer son compte », **When** il s'exécute, **Then** il crée son propre compte, le supprime avec le mot de passe, revient à l'écran de connexion et vérifie que l'ancien mot de passe est refusé.
5. **Given** une vérification qui sort de l'app (scanner le QR code avec un autre téléphone, contenu envoyé par la feuille de partage, page ouverte sur le site, e-mail de réinitialisation), **When** la suite s'exécute, **Then** le parcours vérifie ce qui est visible dans l'app (QR code affiché, feuille de partage ouverte, confirmation de copie) et la suite d'une vérification reste dans le `quickstart.md`.

---

### User Story 4 - Comprendre un échec (Priority: P2)

Quand un parcours échoue, la personne voit à quelle étape et sur quel écran, sans relancer la suite pour le reproduire.

**Why this priority**: Un échec sans contexte coûte souvent plus cher à analyser que la vérification manuelle qu'il remplace.

**Independent Test**: Casser volontairement un libellé de bouton utilisé par un parcours, lancer ce parcours : le rapport nomme le parcours et l'étape fautive, et une capture de l'écran au moment de l'échec est disponible.

**Acceptance Scenarios**:

1. **Given** un parcours qui échoue, **When** la suite se termine, **Then** le résumé nomme le parcours et l'étape qui a échoué.
2. **Given** un parcours qui échoue, **When** la personne ouvre le dossier des résultats, **Then** elle y trouve une capture de l'écran au moment de l'échec, rangée par parcours et par exécution, hors des fichiers versionnés.

---

### User Story 5 - Garder la suite à jour (Priority: P3)

Le guide des agents et la doc de l'app disent comment lancer la suite, et qu'une nouvelle user story de l'app mobile vient avec son parcours. La règle actuelle « pas de test e2e » est remplacée.

**Why this priority**: Sans règle écrite, la suite se périme à la première feature suivante. C'est peu de travail mais indispensable pour que la suite dure.

**Independent Test**: Relire `AGENTS.md` et la doc de l'app : la commande, les prérequis (serveur, base de démo, simulateur), la règle d'ajout d'un parcours et la place qui reste au `quickstart.md` manuel y sont.

**Acceptance Scenarios**:

1. **Given** le guide des agents, **When** une personne cherche comment vérifier l'app mobile, **Then** elle trouve la commande de la suite, ses prérequis et le lien avec les `quickstart.md`.
2. **Given** une future feature qui ajoute une user story à l'app mobile, **When** elle suit le workflow du projet, **Then** le guide lui demande d'ajouter le parcours correspondant.

---

### Edge Cases

- Serveur local injoignable, base de démo absente ou mot de passe de démo non fourni : la commande s'arrête avant le premier parcours avec un message qui dit quoi faire, au lieu de faire échouer chaque parcours un par un.
- Aucun simulateur ni émulateur démarré, ou app non installée : même chose, message clair avant le premier parcours.
- Limite de débit sur la connexion et les actions sensibles : la suite enchaîne des connexions depuis la même adresse ; elle ne doit pas se faire bloquer par cette limite, sans que la limite soit désactivée pour le serveur de production.
- Langue du simulateur : l'app suit la langue du téléphone ; la suite donne le même résultat quelle que soit la langue réglée sur le simulateur, ou fixe elle-même la langue au lancement de l'app.
- Couper le réseau de l'app n'est pas possible de la même manière sur toutes les plateformes : un parcours qui ne peut pas couper le réseau est signalé « non joué » avec la raison, jamais compté comme réussi.
- Préremplissage depuis un lien produit : il dépend d'un service externe optionnel ; le parcours vérifie seulement que le bouton est absent quand le service n'est pas configuré, ce qui est le cas par défaut.
- Animations, chargements et réseau lent : un parcours attend que l'écran soit prêt plutôt qu'une durée fixe, pour ne pas échouer au hasard.
- Données personnelles : les parcours n'utilisent que des comptes fictifs `@example.test` et le mot de passe de démo fourni par variable d'environnement, jamais écrit en clair dans les fichiers versionnés.
- Un parcours interrompu en plein milieu (échec, arrêt manuel) laisse l'app dans un état quelconque : le parcours suivant repart quand même d'un état connu.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La suite DOIT se lancer par une seule commande documentée, sur iOS et sur Android, contre le serveur local.
- **FR-002**: La suite DOIT partir d'une base de démo connue à chaque exécution, quel que soit l'état laissé par les exécutions précédentes.
- **FR-003**: Chaque parcours DOIT pouvoir se lancer seul et donner le même résultat que dans la suite complète, dans n'importe quel ordre.
- **FR-004**: Chaque parcours DOIT partir d'un état connu de l'app (aucune session ni donnée locale héritée d'un autre parcours).
- **FR-005**: L'étape de connexion DOIT être écrite une seule fois et partagée par tous les parcours qui en ont besoin.
- **FR-006**: Un parcours qui détruit des données (suppression de compte, suppression de liste) DOIT travailler sur des données qu'il a créées lui-même.
- **FR-007**: Les noms de comptes, listes et idées créés par un parcours DOIVENT éviter les collisions entre exécutions successives.
- **FR-008**: Les éléments sur lesquels un parcours agit (boutons, champs, onglets) DOIVENT être repérés par un identifiant stable qui ne change pas avec la langue ni avec une reformulation du texte ; les vérifications de messages visibles PEUVENT porter sur le texte affiché.
- **FR-009**: Chaque user story des specs 005 et 006 DOIT avoir au moins un parcours, ou figurer dans une liste d'exclusions qui donne la raison et renvoie à son `quickstart.md`.
- **FR-010**: La suite DOIT produire un résumé par parcours (réussi, échoué, non joué avec raison) et se terminer en échec si au moins un parcours a échoué.
- **FR-011**: Pour chaque échec, la suite DOIT conserver le nom de l'étape fautive et une capture de l'écran, dans un dossier de résultats non versionné.
- **FR-012**: La commande DOIT vérifier ses prérequis (serveur joignable, appareil démarré, app installée, mot de passe de démo fourni) avant de jouer le premier parcours et s'arrêter avec un message explicite s'il en manque un.
- **FR-013**: La suite NE DOIT PAS être bloquée par la limite de débit des actions sensibles, et le moyen employé NE DOIT PAS affaiblir cette limite sur le serveur de production.
- **FR-014**: Les parcours NE DOIVENT contenir ni donnée personnelle réelle ni mot de passe en clair : comptes `@example.test`, mot de passe de démo lu dans l'environnement.
- **FR-015**: Les parcours jetables existants (non versionnés) DOIVENT être remplacés par la suite ; aucun parcours de la suite ne dépend d'eux.
- **FR-016**: Le guide des agents DOIT décrire la commande, ses prérequis, la règle « une user story de l'app mobile = un parcours », et remplacer la mention « pas de test e2e ».
- **FR-017**: L'ajout d'identifiants stables dans l'app NE DOIT changer ni son apparence ni son comportement pour l'utilisateur final.

### Key Entities

- **Parcours** : un scénario automatisé qui suit une user story de l'app mobile ; a un nom, la story qu'il couvre, les données qu'il crée, et s'il est propre à une plateforme.
- **Étape partagée** : une suite d'actions réutilisée par plusieurs parcours (se connecter avec un compte de démo, créer une liste de test).
- **Exécution** : un lancement de la suite ou d'un parcours, sur une plateforme, avec son résumé et ses captures d'échec.
- **Liste d'exclusions** : les vérifications qui restent manuelles, chacune avec sa raison et le renvoi au `quickstart.md`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La suite complète tourne en moins de 15 minutes sur une plateforme, sur la machine de développement.
- **SC-002**: 100 % des user stories des specs 005 et 006 ont un parcours ou une entrée justifiée dans la liste d'exclusions.
- **SC-003**: Trois exécutions complètes consécutives sur une app sans régression donnent trois fois le même résultat, sans échec au hasard.
- **SC-004**: Chaque parcours lancé seul, sur une app fraîchement installée, donne le même résultat que dans la suite complète.
- **SC-005**: Une régression volontaire (bouton retiré d'un écran couvert) fait échouer au moins un parcours, et le rapport permet d'identifier l'écran fautif en moins de 2 minutes, sans relancer la suite.
- **SC-006**: La vérification avant une version passe de la relecture complète des `quickstart.md` 005 et 006 à la commande de la suite plus la seule liste d'exclusions manuelles.

## Assumptions

- La suite se lance en local sur la machine de développement ; le projet n'a pas d'intégration continue, et en ajouter une est hors périmètre.
- La suite cible le simulateur iOS et l'émulateur Android utilisés dans les `quickstart.md`, avec l'app en build de développement pointée sur le serveur local ; les tests sur appareil physique et sur les builds de store sont hors périmètre.
- Les comptes de démo existants (`alex@example.test`, `camille@example.test`) et le script de données de démo sont réutilisés ; le script peut être étendu si un parcours a besoin d'un état de départ qu'il ne fournit pas.
- Le site web n'est pas couvert : la suite ne teste que l'app mobile. Les vérifications « visible sur le site » de l'Independent Test des stories peuvent être faites par l'API depuis la suite ou rester dans la liste d'exclusions.
- La comparaison visuelle avec le site (005, US6) reste manuelle : la suite peut produire des captures, mais elle ne juge pas la ressemblance.
- Les `quickstart.md` restent la référence des parcours réels exigés par le principe IV de la constitution ; la suite automatise la partie qui se joue dans l'app, sans les supprimer.
- L'outil de parcours automatisés nommé dans la demande (Maestro) est celui des parcours jetables actuels ; son choix est acté et se détaille au plan.
