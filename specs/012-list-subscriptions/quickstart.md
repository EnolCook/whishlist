# Quickstart: S'abonner à des listes pour suivre leur contenu

**Feature**: `012-list-subscriptions` | **Date**: 2026-11-02

## Prérequis et contrôles automatisés

```bash
# Migration et types
npm run typecheck
npm run lint
npm test

# Contrat OpenAPI -> types mobile + tests mobile
npm --prefix mobile run api:types
npm --prefix mobile run typecheck
npm --prefix mobile run lint
npm --prefix mobile test
```

## Préparation des données de démo

```bash
DEMO_PASSWORD=demo-pass-1234 npm run demo:data -- tmp/demo-wishlist.json
WISHLIST_DATA_PATH=tmp/demo-wishlist.json npm run dev
```

Comptes et listes de démo disponibles :
- `alex@example.test` (propriétaire de « Nos envies toute l’année », `/l/demo-list-lecture`)
- `camille@example.test` (membre de « Nos envies toute l’année »)
- `sam@example.test` (propriétaire d'une autre liste séparée « Les idées de Sam », `/l/demo-other-lecture`)

---

## Parcours 1 — S'abonner depuis la page publique sur le site (US1)

1. Ouvrir la page publique `/l/demo-other-lecture` (liste de Sam) en étant connecté avec `alex@example.test` (ou inversement `/l/demo-list-lecture` en étant connecté avec `sam@example.test`).
2. Cliquer sur **« Suivre cette liste »** :
   - Le bouton passe à **« Liste suivie »** avec l'action **« Ne plus suivre »**.
3. Cliquer sur **« Mes listes »** dans l'en-tête :
   - La section **« Mes listes »** affiche « Nos envies toute l’année » et la section **« Listes suivies »** affiche « Les idées de Sam » avec sa couverture et son sous-titre.
   - Cliquer sur la carte ouvre `/l/demo-other-lecture`.
4. Se connecter avec `sam@example.test` et ouvrir `/listes/demo-other-list` (onglets Partage, Réglages, Réservations) :
   - Aucune mention de l'abonnement d'Alex n'est visible.

## Parcours 2 — Suivre par lien et consulter dans l'app mobile (US2)

1. Lancer l'app mobile pointée sur le serveur local (`EXPO_PUBLIC_API_URL=http://localhost:3000`).
2. Se connecter avec `alex@example.test` (ou `sam@example.test`).
3. Sur l'écran **« Mes listes »**, toucher **« Suivre une liste »** dans la section **« Listes suivies »**.
4. Coller le lien public complet `http://localhost:3000/l/demo-other-lecture` (ou `http://localhost:3000/l/demo-list-lecture` si connecté avec Sam) et valider :
   - La vue de la liste s'ouvre (la même que pour son lien public) avec ses idées disponibles et le bouton **« Ne plus suivre »**.
5. Choisir une catégorie, filtrer par personne ou budget, puis toucher **« Réserver ce cadeau »** sur une idée :
   - Saisir un petit mot et confirmer : de retour sur la liste, l'idée affiche le badge **« Réservé par vous »** et le bouton **« Annuler la réservation »**.
6. Revenir sur **« Mes listes »** : la liste figure dans **« Listes suivies »**.
7. **Mode hors ligne (US2 scénario 4)** : couper le réseau (mode avion sur Android), rouvrir la liste suivie depuis **« Listes suivies »** :
   - Le bandeau hors ligne s'affiche et les idées de la dernière copie synchronisée restent consultables ; les boutons de réservation et de désabonnement sont désactivés.
8. **Liste protégée par mot de passe de lecture (US2 scénario 2, FR-003)** :
   - Sur le site, avec `alex@example.test`, poser un mot de passe de lecture sur la liste (onglet « Partage »).
   - Avec `sam@example.test` (sur le site ou dans l'app mobile), ouvrir la liste suivie : le mot de passe de lecture est demandé avant d'afficher les idées ; une fois saisi, l'accès est rétabli.

## Parcours 3 — Se désabonner sans perdre ses réservations (US3)

1. Depuis la liste suivie (sur le site ou dans l'app mobile), choisir **« Ne plus suivre »** et confirmer :
   - La liste disparaît de la section **« Listes suivies »** d'Alex (ou de Sam).
2. Rouvrir `/l/demo-other-lecture` avec le compte d'Alex (ou vérifier côté Sam dans l'onglet « Réservations ») :
   - Le cadeau réservé à l'étape précédente est toujours réservé.

## Parcours 4 — Suivre une liste en scannant son QR code (US4)

Sur deux téléphones réels (la caméra n'existe pas dans le simulateur) :

1. Téléphone A, connecté avec `alex@example.test` : ouvrir la liste, puis **« Partager »** : le QR code du lien public s'affiche.
2. Téléphone B, connecté avec `sam@example.test` : **« Mes listes »** → **« Suivre une liste »** → **« Scanner un QR code »**, autoriser la caméra, viser le QR code du téléphone A :
   - La vue de la liste s'ouvre avec **« Ne plus suivre »**, et la liste figure dans **« Listes suivies »**.
3. Scanner un autre QR code (un site web quelconque) : le message « Ce QR code n'est pas le lien d'une liste. » s'affiche et le scan continue.
4. Refuser l'accès à la caméra (Réglages → l'app → Caméra) puis toucher **« Scanner un QR code »** : un message renvoie vers les réglages, et coller le lien reste possible.

## Parcours Maestro (app mobile)

```bash
DEMO_PASSWORD=demo-pass-1234 npm --prefix mobile run e2e -- .maestro/flows/012-us2-follow-and-browse.yaml
DEMO_PASSWORD=demo-pass-1234 npm --prefix mobile run e2e -- .maestro/flows/012-us3-unfollow.yaml
```
