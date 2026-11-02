# Feature Specification: Validation de l'adresse e-mail et changement d'adresse

**Feature Branch**: `010-email-verification-change`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "On va mettre en place la validation de compte par mail et la possibilité de changer d'email"

## Contexte

Aujourd'hui, une personne crée un compte (sur le site ou dans l'app) avec une adresse e-mail que personne ne vérifie. Une faute de frappe la prive de la réinitialisation du mot de passe, et rien n'empêche d'ouvrir un compte avec l'adresse de quelqu'un d'autre. Une fois inscrite, la personne ne peut plus changer son adresse de connexion : l'écran « Mon compte » l'affiche sans permettre de la modifier.

Cette feature ajoute deux choses :

1. **La validation de l'adresse** : après l'inscription, un e-mail contient un lien de confirmation. L'ouvrir marque l'adresse comme vérifiée.
2. **Le changement d'adresse** : depuis « Mon compte », la personne saisit une nouvelle adresse et son mot de passe. Un lien est envoyé à la nouvelle adresse, et le changement n'a lieu qu'à l'ouverture de ce lien. L'ancienne adresse est prévenue.

**Périmètre** : le site, l'API et l'app mobile. Les liens reçus par e-mail ouvrent le site, comme le lien de réinitialisation du mot de passe aujourd'hui. L'app affiche l'état de l'adresse, permet de renvoyer le lien et de demander un changement d'adresse.

**Envoi d'e-mail optionnel** : l'envoi d'e-mail reste un service optionnel (constitution, « Hébergement Docker »). Sans lui, la validation n'existe pas : aucun compte n'est bloqué ni signalé comme non vérifié, et le changement d'adresse s'applique dès que le mot de passe est confirmé.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Confirmer son adresse après l'inscription (Priority: P1)

Une personne crée son compte. Elle est connectée tout de suite et un écran lui indique qu'un e-mail de confirmation a été envoyé à son adresse. Elle ouvre l'e-mail, touche le lien, et arrive sur le site, qui lui confirme que son adresse est vérifiée. Tant qu'elle n'a pas confirmé, un bandeau sur le site et dans l'app lui rappelle de le faire. Ce bandeau propose de renvoyer le lien. En attendant, elle peut se connecter et consulter, mais pas créer de liste, ni en rejoindre une par invitation, ni inviter : ces actions lui demandent d'abord de confirmer son adresse. Réserver une idée sur une liste partagée reste possible, comme sans compte.

**Why this priority**: c'est le cœur de la demande. Sans adresse vérifiée, la réinitialisation du mot de passe et le changement d'adresse n'ont aucune garantie.

**Independent Test**: sur la base de démo, avec l'envoi d'e-mail en mode développement (lien affiché ou écrit dans le journal des e-mails), créer un compte, constater le bandeau, tenter de créer une liste et constater le refus, ouvrir le lien, constater que le bandeau a disparu sur le site et dans l'app et que la création de liste fonctionne. Un parcours Maestro `010-us1` rejoue la partie app (bandeau et création refusée après l'inscription, puis bandeau absent une fois l'adresse confirmée).

**Acceptance Scenarios**:

1. **Given** l'envoi d'e-mail configuré, **When** une personne crée un compte sur le site ou dans l'app, **Then** elle est connectée, un e-mail de confirmation part à l'adresse saisie, dans la langue de l'inscription, et un message lui indique de consulter sa boîte.
2. **Given** un compte non vérifié, **When** la personne ouvre le lien de confirmation valide, connectée ou non, sur n'importe quel appareil, **Then** l'adresse est marquée vérifiée et une page le confirme, avec un lien vers ses listes (ou vers la connexion si elle n'est pas connectée).
3. **Given** un compte non vérifié et connecté, **When** il consulte le site ou l'app, **Then** un bandeau rappelle de confirmer l'adresse et propose de renvoyer le lien.
4. **Given** un compte vérifié, **When** il consulte le site ou l'app, **Then** aucun bandeau n'apparaît.
5. **Given** un compte non vérifié, **When** il tente de créer une liste, de rejoindre une liste par un lien d'invitation ou d'inviter quelqu'un, sur le site, dans l'app ou par l'API, **Then** l'action est refusée avec un message qui l'invite à confirmer son adresse et propose de renvoyer le lien.
6. **Given** une personne qui s'est inscrite depuis un lien d'invitation, **When** elle confirme son adresse, **Then** la page de confirmation lui propose de reprendre l'invitation pour rejoindre la liste.
7. **Given** un compte non vérifié, **When** il ouvre une liste partagée par son lien de lecture, **Then** il la consulte et peut réserver une idée comme une personne sans compte.
8. **Given** un lien de confirmation déjà utilisé, expiré ou inconnu, **When** on l'ouvre, **Then** une page explique que le lien n'est plus valide et, si le compte n'est pas encore vérifié, propose d'en demander un nouveau après connexion.
9. **Given** l'envoi d'e-mail non configuré, **When** une personne crée un compte, **Then** aucun e-mail n'est demandé, aucun bandeau n'apparaît et le compte a toutes ses possibilités.

---

### User Story 2 - Renvoyer le lien de confirmation (Priority: P2)

La personne n'a pas reçu l'e-mail, l'a supprimé ou laissé expirer. Depuis le bandeau ou depuis « Mon compte », sur le site ou dans l'app, elle demande un nouveau lien. Un nouvel e-mail part, et l'ancien lien cesse de fonctionner.

**Why this priority**: sans renvoi, un e-mail perdu bloque la personne pour de bon. Ce n'est utile qu'une fois l'US1 en place.

**Independent Test**: sur la base de démo, depuis un compte non vérifié, demander un nouveau lien. Vérifier que l'ancien lien est refusé et que le nouveau valide l'adresse. Un parcours Maestro `010-us2` rejoue la demande depuis l'app.

**Acceptance Scenarios**:

1. **Given** un compte non vérifié et connecté, **When** il demande un nouveau lien, **Then** un e-mail part, un message confirme l'envoi et seul le dernier lien envoyé reste valide.
2. **Given** un compte qui a déjà demandé plusieurs liens en peu de temps, **When** il en redemande un au-delà de la limite, **Then** la demande est refusée avec un message qui invite à réessayer plus tard.
3. **Given** un compte déjà vérifié, **When** il tente de demander un lien (par exemple depuis un écran resté ouvert), **Then** aucun e-mail ne part et un message indique que l'adresse est déjà vérifiée.

---

### User Story 3 - Changer son adresse e-mail (Priority: P2)

Une personne veut se connecter avec une autre adresse. Dans « Mon compte » (site ou app), elle saisit la nouvelle adresse et son mot de passe actuel. Un e-mail part vers la nouvelle adresse avec un lien de confirmation. Tant qu'elle ne l'a pas ouvert, elle se connecte toujours avec l'ancienne adresse, et « Mon compte » indique le changement en attente, avec la possibilité de l'annuler. À l'ouverture du lien, la nouvelle adresse devient l'adresse de connexion, déjà vérifiée. Un e-mail prévient l'ancienne adresse du changement.

**Why this priority**: c'est la seconde demande. Elle a de la valeur même sans la validation à l'inscription, mais elle repose sur le même lien de confirmation.

**Independent Test**: sur la base de démo, depuis un compte, demander le changement vers une adresse libre, ouvrir le lien, se déconnecter, se reconnecter avec la nouvelle adresse, vérifier que l'ancienne est refusée et que l'e-mail de notification a été envoyé à l'ancienne adresse. Un parcours Maestro `010-us3` rejoue la demande depuis l'app et l'affichage du changement en attente.

**Acceptance Scenarios**:

1. **Given** une personne connectée, **When** elle saisit une nouvelle adresse valide et libre et son mot de passe correct, **Then** un e-mail de confirmation part vers la nouvelle adresse, l'adresse de connexion ne change pas encore et « Mon compte » affiche « changement en attente vers <nouvelle adresse> ».
2. **Given** un changement en attente, **When** le lien envoyé à la nouvelle adresse est ouvert avant expiration, **Then** la nouvelle adresse devient l'adresse de connexion et est vérifiée, l'ancienne ne permet plus de se connecter, et un e-mail informe l'ancienne adresse du changement (sans lien d'action).
3. **Given** un mot de passe incorrect, **When** la personne demande le changement, **Then** la demande est refusée et rien n'est envoyé.
4. **Given** une nouvelle adresse invalide ou identique à l'adresse actuelle, **When** la personne demande le changement, **Then** la demande est refusée avec un message adapté.
4b. **Given** une nouvelle adresse déjà utilisée par un autre compte, **When** la personne demande le changement, **Then** la réponse est la même que pour une adresse libre (changement en attente), pour ne pas révéler les comptes existants, comme l'inscription ; aucun e-mail ne part vers cette adresse, et le changement ne peut pas aboutir (revue du 2026-11-02). Sans envoi d'e-mail, où l'adresse s'appliquerait tout de suite, la demande est refusée.
5. **Given** un changement en attente, **When** la personne l'annule ou demande un changement vers une autre adresse, **Then** le lien précédent cesse de fonctionner.
6. **Given** un changement en attente vers une adresse qu'un autre compte prend entre-temps, **When** le lien est ouvert, **Then** le changement est refusé avec un message clair et l'adresse actuelle reste inchangée.
7. **Given** l'envoi d'e-mail non configuré, **When** la personne demande le changement avec son mot de passe correct, **Then** la nouvelle adresse est appliquée immédiatement.
8. **Given** une personne qui a changé d'adresse, **When** elle demande une réinitialisation du mot de passe, **Then** l'e-mail part vers la nouvelle adresse seulement.

---

### Edge Cases

- **Comptes existants** avant la mise en service : ils sont considérés comme vérifiés d'office et ne voient ni bandeau ni restriction. Seuls les comptes créés ensuite confirment leur adresse.
- **Compte non vérifié et file hors ligne de l'app** : l'app n'offre pas la création de liste à un compte non vérifié. Si une création en attente dans la file est refusée par le serveur pour ce motif, l'app affiche le même message que pour les autres refus.
- **Réinitialisation du mot de passe** depuis un compte non vérifié : le lien de réinitialisation arrive à l'adresse et prouve donc qu'elle est valide. La réinitialisation réussie marque l'adresse comme vérifiée.
- **Lien ouvert par une autre personne connectée** sur le même navigateur : la confirmation porte sur le compte du lien, pas sur la session ouverte. La page n'affiche pas l'adresse en entier à une personne non connectée à ce compte.
- **Casse et espaces** : la nouvelle adresse est normalisée comme à l'inscription (minuscules, sans espaces autour). `Alice@Example.test` est donc la même adresse que `alice@example.test`.
- **Échec d'envoi** (service indisponible) : la demande reste enregistrée et un message invite à renvoyer le lien plus tard. L'adresse de connexion ne change pas.
- **Compte supprimé** avec un lien encore en circulation : le lien est refusé comme inconnu. Les demandes en attente sont supprimées avec le compte.
- **Suppression ou export du compte** : l'export de ses données indique si l'adresse est vérifiée et le changement en attente, s'il y en a un.
- **Changement de mot de passe imposé** à la connexion : la personne doit d'abord changer son mot de passe. Le bandeau de confirmation et le changement d'adresse ne sont accessibles qu'ensuite.
- **App hors ligne** : la demande de renvoi et la demande de changement d'adresse demandent une connexion. Elles ne passent pas par la file hors ligne, et l'app affiche l'erreur réseau habituelle.
- **Compte de revue des stores** et comptes de démo : ils doivent pouvoir se connecter et tout tester sans recevoir d'e-mail. Les données de démo créent donc des comptes déjà vérifiés.

## Requirements *(mandatory)*

### Functional Requirements

**Validation de l'adresse**

- **FR-001**: Quand l'envoi d'e-mail est configuré, le système DOIT envoyer un e-mail de confirmation à l'adresse de chaque nouveau compte, créé sur le site ou par l'API, dans la langue de l'inscription.
- **FR-002**: Le lien de confirmation DOIT être à usage unique, propre à un compte, impossible à deviner, et expirer au bout de 24 heures.
- **FR-003**: Ouvrir un lien de confirmation valide DOIT marquer l'adresse du compte comme vérifiée, que la personne soit connectée ou non.
- **FR-004**: Un compte non vérifié DOIT voir, sur le site et dans l'app, un rappel qui propose de renvoyer le lien.
- **FR-005**: Un compte non vérifié DOIT pouvoir se connecter, consulter ses écrans et réserver comme une personne sans compte, mais le système DOIT refuser, sur le site comme par l'API, la création d'une liste, l'acceptation d'une invitation et l'envoi d'une invitation, avec un message qui invite à confirmer l'adresse.
- **FR-005b**: Les comptes existant avant la mise en service DOIVENT être considérés comme vérifiés.
- **FR-006**: La personne DOIT pouvoir demander un nouveau lien de confirmation. Chaque nouveau lien invalide le précédent. Les demandes sont limitées à 5 par heure et par compte.
- **FR-007**: Une réinitialisation du mot de passe réussie DOIT marquer l'adresse comme vérifiée.
- **FR-008**: Sans envoi d'e-mail configuré, le système NE DOIT NI envoyer de lien, NI afficher de rappel, NI restreindre un compte.

**Changement d'adresse**

- **FR-009**: Une personne connectée DOIT pouvoir demander un changement d'adresse depuis « Mon compte », sur le site et dans l'app, en saisissant la nouvelle adresse et son mot de passe actuel.
- **FR-010**: Le système DOIT refuser la demande si le mot de passe est faux, si l'adresse est invalide ou identique à l'adresse actuelle. Une adresse déjà utilisée par un autre compte DOIT recevoir la même réponse qu'une adresse libre, sans e-mail vers elle ; elle n'est refusée que sans envoi d'e-mail (changement immédiat). Les demandes sont limitées en débit, comme les autres actions sensibles.
- **FR-011**: Quand l'envoi d'e-mail est configuré, le système DOIT envoyer à la nouvelle adresse un lien de confirmation à usage unique, valable 24 heures. L'adresse de connexion ne change qu'à l'ouverture de ce lien.
- **FR-012**: Un compte DOIT avoir au plus un changement d'adresse en attente. Une nouvelle demande ou une annulation invalide le lien précédent.
- **FR-013**: « Mon compte » DOIT afficher le changement en attente (nouvelle adresse) et permettre de l'annuler.
- **FR-014**: À la confirmation, le système DOIT vérifier de nouveau que l'adresse est libre, l'appliquer comme adresse de connexion vérifiée, et envoyer à l'ancienne adresse un e-mail informatif qui donne la nouvelle adresse sous forme partiellement masquée et indique quoi faire si la personne n'est pas à l'origine du changement.
- **FR-015**: Sans envoi d'e-mail configuré, le système DOIT appliquer la nouvelle adresse dès que le mot de passe est confirmé.
- **FR-016**: Après le changement, la connexion, la réinitialisation du mot de passe et les e-mails futurs DOIVENT utiliser la nouvelle adresse uniquement.

**Commun**

- **FR-017**: Les liens de confirmation ne DOIVENT pas être écrits en clair dans les journaux de production (même règle que pour les liens de réinitialisation).
- **FR-018**: Tous les textes ajoutés (pages, bandeau, messages, e-mails) DOIVENT exister en français et en anglais, en vouvoyant en français.
- **FR-019**: Les nouvelles opérations DOIVENT être disponibles par l'API, pour que l'app offre la même chose que le site : état de l'adresse et changement en attente dans le profil, renvoi du lien, demande et annulation d'un changement.
- **FR-020**: L'export des données du compte DOIT inclure l'état de vérification de l'adresse et le changement en attente, s'il y en a un.

### Key Entities

- **Compte** : gagne un état « adresse vérifiée » (avec sa date) en plus de son adresse de connexion.
- **Demande de confirmation d'adresse** : rattachée à un compte. Elle porte l'adresse à confirmer (l'adresse actuelle pour une validation, la nouvelle pour un changement), le motif (validation ou changement), une empreinte du jeton secret, une date de création et une date d'expiration. Une seule demande active par compte et par motif.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Une personne qui vient de s'inscrire confirme son adresse en moins d'une minute après réception de l'e-mail, en deux gestes : ouvrir le lien, puis confirmer sur la page (research R4).
- **SC-002**: Une personne change son adresse de connexion en moins de 2 minutes, de la saisie dans « Mon compte » à la première connexion avec la nouvelle adresse.
- **SC-003**: 100 % des liens expirés, déjà utilisés ou remplacés sont refusés.
- **SC-004**: Aucune adresse de connexion ne change sans le mot de passe actuel et, quand l'envoi d'e-mail est configuré, sans l'ouverture du lien envoyé à la nouvelle adresse.
- **SC-005**: Sans service d'e-mail configuré, l'inscription, la connexion et l'usage des listes fonctionnent comme avant la feature.
- **SC-006**: L'app mobile offre les mêmes actions que le site pour l'état de l'adresse, le renvoi du lien et le changement d'adresse.

## Assumptions

- Le service d'envoi d'e-mail déjà utilisé pour la réinitialisation du mot de passe et les invitations sert aussi ici. En développement, quand il n'est pas configuré, les e-mails vont dans le journal local et le lien peut être affiché, comme pour la réinitialisation.
- Les liens reçus par e-mail ouvrent le site, pas l'app, comme le lien de réinitialisation aujourd'hui. Ouvrir ces liens directement dans l'app (liens universels) est hors périmètre.
- Durée de validité de 24 heures pour les deux types de lien (contre 1 heure pour la réinitialisation, plus sensible).
- Changer d'adresse ne déconnecte pas les sessions ouvertes. L'e-mail envoyé à l'ancienne adresse permet de réagir (réinitialiser le mot de passe) si le changement n'est pas légitime.
- Les invitations à rejoindre une liste passent par un lien et ne dépendent pas de l'adresse du compte. Le changement d'adresse ne les affecte donc pas.
- L'administration des comptes par un tiers (changer l'adresse d'un autre compte) est hors périmètre.
- Le principe II de la constitution (« créer une wishlist exige un compte ») devient plus strict : quand l'envoi d'e-mail est configuré, il faut un compte à l'adresse vérifiée. Consulter et réserver sans compte ne changent pas.
- La constitution mentionne l'« envoi d'e-mail » comme complexité à justifier par une spec explicite : cette spec en est la justification. L'envoi reste optionnel.
