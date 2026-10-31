# Quickstart: vérifier l'app mobile

Parcours manuels sur la base de démo, sur **simulateur iOS** et **émulateur Android** (taille d'écran 390 × 844 pour les comparaisons de design). Ils confirment chaque tranche (principe IV), en plus des tests automatiques (`npm --prefix mobile test`).

La partie « dans l'app » de ces parcours est automatisée par la suite e2e (`npm --prefix mobile run e2e`, voir [mobile/.maestro/README.md](../../mobile/.maestro/README.md)). Ce qu'elle ne vérifie pas est listé dans [mobile/.maestro/exclusions.md](../../mobile/.maestro/exclusions.md).

## Prérequis

```bash
# Serveur (site + API) sur la base de démo, joignable depuis le simulateur
npm ci
export DEMO_PASSWORD='demo-password-1'
npm run demo:data -- tmp/demo-wishlist.json
WISHLIST_DATA_PATH=tmp/demo-wishlist.json SESSION_SECRET=dev-secret-dev-secret-dev-secret-00 npm run dev

# App
npm --prefix mobile ci
EXPO_PUBLIC_API_URL=http://<ip-du-mac>:3000 npm --prefix mobile run ios      # ou: run android
```

Comptes : `alex@example.test` (propriétaire de « Nos envies toute l'année ») et `camille@example.test`, mot de passe `$DEMO_PASSWORD`.

## US1 : connexion et compte

1. Première ouverture → écran de connexion. Mauvais mot de passe → « E-mail ou mot de passe incorrect. », sans dire lequel.
2. Connexion avec Alex → « Mes listes ».
3. Tuer l'app, la rouvrir → toujours « Mes listes », sans ressaisie (moins de 2 s, SC-004).
4. « Créer un compte » avec `lou@example.test` → connecté. Avec `alex@example.test` → message « vérifiez vos e-mails », pas de connexion.
5. Mon compte → Se déconnecter → écran de connexion. Rejouer l'ancien jeton avec `curl -H "Authorization: Bearer …" $API/me` → `401`.
6. Changer le mot de passe d'Alex depuis le site → l'app revient à la connexion à sa prochaine action, avec un message.
7. « Mot de passe oublié » → même message pour un e-mail connu et inconnu ; le lien est dans `data/mail.log` et ouvre le site.

## US2 : mes listes, nouvelle liste

1. Alex voit « Nos envies toute l'année », Camille aussi (membre), Lou aucune (écran « créez votre première liste »).
2. Nouvelle liste « Noël » / « Livres » / « Alex » → la liste s'ouvre ; elle est sur le site.
3. Titre vide → même message que le site, rien n'est créé.
4. Renommer une catégorie sur le site, tirer pour rafraîchir dans l'app → le nouveau nom apparaît.

## US3 : remplir une liste

1. Ajouter « Puzzle 1000 pièces », Jeux, Alex, 24,90 € → visible dans sa catégorie, et sur le site.
2. Prix « abc » → « Saisissez un prix valide, par exemple 18,50. » sous le champ ; les autres champs restent remplis.
3. Avec `GEMINI_API_KEY` ou `OPENAI_API_KEY` : coller un lien produit → « Remplir depuis le lien » remplit nom, prix, image, catégorie. Sans clé : le bouton est absent.
4. Modifier, archiver (onglet Archives), désarchiver, supprimer (avec confirmation) → chaque changement est sur le site.
5. Réglages : ajouter, renommer, réordonner une catégorie ; retirer une catégorie utilisée → refus avec le message du site.
6. Onglet Réservations : la réservation de démo montre l'offreur et le petit mot.

## US4 : partager

1. Onglet Partage → QR code + « Partager » + champ lien avec « Copier ».
2. Scanner le QR code avec un autre téléphone à 20–50 cm → la page publique de la liste s'ouvre du premier coup (SC-002), en anglais si l'app est en anglais.
3. « Partager » → feuille de partage ; vers Messages : le texte contient le titre et le lien public (jamais le lien d'invitation).
4. « Copier » → confirmation ; coller dans Notes : c'est le lien public.
5. Poser un mot de passe de lecture sur le site → l'onglet Partage le signale, sans l'afficher.

## US5 : hors ligne

1. Ouvrir « Nos envies toute l'année » avec le réseau, puis activer le mode avion.
2. Le bandeau « Hors ligne · dernière mise à jour à … » apparaît ; la liste reste lisible.
3. Ajouter deux idées, en modifier une, en archiver une, créer la liste « Anniversaire » et y ajouter une idée → tout apparaît, avec le badge « En attente ».
4. Tuer l'app, la rouvrir en mode avion → les changements sont toujours là.
5. Couper le mode avion → en moins de 30 s (SC-009), les badges disparaissent ; tout est sur le site, sans doublon.
6. Coupures pendant l'envoi : refaire 3 à 5 avec 20 changements, en recoupant le réseau au milieu de l'envoi → 20 changements sur le site, aucun doublon (SC-008).
7. Refus : hors ligne, modifier une idée ; sur le site, supprimer cette idée ; rétablir le réseau → alerte rouge « Cette idée n'existe pas. » avec « Corriger » / « Abandonner » ; les autres changements passent.
8. Avec des changements en attente, « Se déconnecter » → avertissement qu'ils seront perdus.
9. Hors ligne, onglet Partage d'une liste connue → QR code et copie marchent ; d'une liste créée hors ligne → indisponible, avec explication.
10. Hors ligne, Réglages et préremplissage → indisponibles, avec explication.

## US6 : design, écran par écran

1. Refaire les captures du site en largeur mobile :

   ```bash
   DEMO_BASE_URL=http://localhost:3000 npm run demo:capture -- --mobile   # → specs/005-mobile-list-app/design/web-mobile/
   ```

2. Capturer les mêmes écrans dans l'app (même compte, mêmes données) : `xcrun simctl io booted screenshot <fichier>.png` (iOS), `adb exec-out screencap -p > <fichier>.png` (Android).
3. Pour chaque ligne de [contracts/screens.md](contracts/screens.md), placer les deux captures côte à côte et cocher la grille :

   | Point | Attendu |
   |-------|---------|
   | Couleurs | fond `#e8f0ff`, bleu `#1a56e8`, jaune `#ffd700`, rouge, blanc des cartes (pipette) |
   | Police | Geist, 500 / 700 aux mêmes endroits |
   | Bordures | 2 px noires sur boutons, champs, cartes, badges |
   | Ombres | pleine, noire, décalée de 4 px en bas à droite, sans flou |
   | Rayons | 5 px |
   | Organisation | mêmes blocs, dans le même ordre, mêmes titres |
   | Libellés | mot pour mot ceux du site |
   | Appui | le bouton « s'enfonce » (vidéo ou capture pendant l'appui) |
   | Thème | une liste au thème personnalisé (réglé sur le site) prend ses couleurs |

4. Refaire en anglais (langue du téléphone) et avec le texte agrandi au maximum.
5. Tout écart : corrigé, ou justifié dans [design-reference.md](design-reference.md) (SC-005).

## Non-régression du site

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` à la racine, puis le parcours du guide sur le site (lire, réserver, ajouter une idée).
