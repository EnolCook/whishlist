# UI Contracts: Site Web & Application Mobile — Abonnements aux listes

**Feature**: `012-list-subscriptions` | **Date**: 2026-11-02

## 1. Site Web (`app/`)

### 1.1 Page publique d'une liste (`app/l/[readToken]/page.tsx`)
- **Visiteur non connecté** :
  - Bouton secondaire « Suivre cette liste » à côté de « Réserver un cadeau », pointant vers `/connexion?next=/l/<readToken>`.
- **Utilisateur connecté non membre** :
  - S'il ne suit pas encore la liste : formulaire avec bouton « Suivre cette liste » (`subscribeAction`).
  - S'il suit déjà la liste : badge « Liste suivie » et bouton « Ne plus suivre » (`unsubscribeAction`).
- **Membre connecté de la liste** :
  - Aucun bouton « Suivre cette liste » (il est déjà membre).

### 1.2 Page « Mes listes » (`app/page.tsx`)
- **Section « Mes listes »** (inchangée : listes dont l'utilisateur est membre, ou état vide avec « Créer une liste »).
- **Section « Listes suivies »** (`<section>` sous « Mes listes ») :
  - En-tête avec titre `h2` « Listes suivies » et formulaire compact permettant de coller un lien public (`/l/...`) et cliquer sur « Suivre » (`subscribeByLinkAction`).
  - Si la liste collée est protégée par un mot de passe de lecture non encore déverrouillé, redirection vers `/l/[readToken]` où le formulaire de déverrouillage s'affiche (et abonne l'utilisateur dès le mot de passe validé si demandé).
  - Cartes des listes suivies : même présentation que les cartes de « Mes listes » (`WishlistCover`, titre pointant vers `/l/[readToken]`, sous-titre), avec un bouton discret « Ne plus suivre ».

## 2. Application Mobile (`mobile/`)

### 2.1 Écran « Mes listes » (`mobile/app/(app)/index.tsx`)
- Sous la liste des listes personnelles (ou sous l'état vide si l'utilisateur n'a créé aucune liste), affiche la section **« Listes suivies »** (`testID="lists.subscriptions-section"`).
- Bouton « Suivre une liste » (`testID="lists.follow-open"`) qui ouvre l'écran d'ajout `mobile/app/(app)/shared/follow.tsx`.
- Chaque liste suivie est affichée dans une `Card` (`testID="lists.shared-card-<readToken>"`) avec `ListCover`, `title`, `subtitle` (et une mention si la liste est verrouillée par un nouveau mot de passe), qui navigue vers la vue de la liste `/guest/[readToken]` (§ 2.3).

### 2.2 Écran « Suivre une liste » (`mobile/app/(app)/shared/follow.tsx`)
- Champ `Field` + `Input` pour coller le lien ou le jeton (`testID="follow.link"`).
- Si l'API répond `423 readPasswordRequired`, affiche le titre de la liste et un champ mot de passe de lecture (`testID="follow.password"`).
- Bouton de validation (`testID="follow.submit"`) → redirige vers `/guest/[readToken]`.

### 2.3 Vue d'une liste (`mobile/app/guest/[readToken]/index.tsx`)
Une liste suivie s'ouvre sur la même vue que son lien public (feature 011, vue invité) : un seul écran pour une
liste publique, comme la page `/l/[readToken]` du site. La 012 y ajoute :
- **Suivre / Ne plus suivre** (`@/features/guest/GuestFollow`), avec un compte et hors membre de la liste
  (`PublicList.subscribed`, `PublicList.isMember`) : « Suivre cette liste » (`testID="guest.follow"`) ou
  « Ne plus suivre » (`testID="guest.unfollow"`, confirmation `testID="guest.unfollow-confirm"`). Les textes sont
  ceux de la page publique du site (`public:subscription.*`).
- **Filtres** « Pour qui ? » (si plusieurs personnes) et « Budget », en plus des catégories ; idées triées par
  envie puis dans l'ordre du propriétaire (`filterAndSortPublicItems`), comme sur le site.
- **Hors ligne** : une liste suivie garde sa dernière lecture (snapshot `publicList:<readToken>`) et s'affiche
  avec le bandeau hors ligne. Une liste seulement ouverte par son lien ne garde rien. Réserver reste en ligne.
- **Liste suivie verrouillée** (mot de passe changé) : le formulaire de déverrouillage propose aussi
  « Ne plus suivre », d'après « Listes suivies » (copie locale de `GET /lists`).
- Réserver passe par l'écran « Réserver un cadeau » de la vue invité (`/guest/[readToken]/reserve`), qui revient
  à la liste (relue au retour).
