# Quickstart: vérifier les cartes repliables de l'écran de compte

Parcours manuels sur la base de démo (principe IV), sur simulateur iOS et émulateur Android. Ils complètent `npm --prefix mobile test`. La suite e2e rejoue US1 étapes 1 à 3 et le repli de l'étape 4, US2 étapes 1, 2 et 4, US3 étapes 1 à 3 et US4 étapes 1 à 3 (`npm --prefix mobile run e2e -- .maestro/flows/009-us1-profile-card.yaml`, puis `009-us2-password-card.yaml`, `009-us3-data-card.yaml`, `009-us4-ideas-categories.yaml` ; voir [mobile/.maestro/README.md](../../mobile/.maestro/README.md)). Le reste, dont l'envoi du formulaire de mot de passe sur iOS (US2 étape 3), est listé dans [mobile/.maestro/exclusions.md](../../mobile/.maestro/exclusions.md) ; les tests d'écran couvrent les messages dans la carte ouverte et l'appui dans un champ.

## Prérequis

Mêmes que le [quickstart de la 005](../005-mobile-list-app/quickstart.md#prérequis). Compte : `alex@example.test` (mot de passe `DEMO_PASSWORD`).

## US1 : carte Profil

1. Se connecter, ouvrir « Mon compte » : la carte « Profil » ne montre que « Profil », « Votre nom et votre adresse de connexion. » et un chevron vers le bas. La carte « Vos données et informations » commence dans le premier écran (SC-001).
2. Toucher l'en-tête : la carte s'agrandit en douceur (moins d'une demi-seconde), le chevron pivote, le nom et l'adresse apparaissent ; les cartes du dessous descendent sans saut.
3. Changer le nom, « Enregistrer » : la confirmation apparaît dans la carte, toujours dépliée.
4. Toucher l'en-tête : la carte se replie ; toucher un champ dépliée ne la replie pas.
5. Taper dans le champ nom, replier avec le clavier ouvert : le clavier se ferme. Redéplier : la saisie est conservée.
6. Appuyer très vite plusieurs fois sur l'en-tête : la carte finit dans l'état du dernier appui, sans rester à mi-hauteur.
7. VoiceOver (iOS) puis TalkBack (Android) : l'en-tête est annoncé « Profil, bouton, réduit » puis « développé » ; carte repliée, les champs ne sont pas lus.
8. Réglage « Réduire les animations » (iOS : Accessibilité › Mouvement ; Android : Accessibilité › Supprimer les animations) : la carte s'ouvre et se ferme sans mouvement.
9. Mode avion : la carte se déplie ; « Enregistrer » reste désactivé comme aujourd'hui.
10. Quitter l'écran et y revenir : la carte est de nouveau repliée.

## US2 : carte Mot de passe

1. Ouvrir « Mon compte » : la carte « Modifier le mot de passe » ne montre que son titre et le chevron.
2. Toucher l'en-tête : les trois champs et le bouton apparaissent avec la même animation.
3. Saisir un mauvais mot de passe actuel : l'erreur apparaît dans la carte dépliée. Recommencer avec le bon : le succès apparaît.
4. Déplier la carte Profil en même temps : les deux restent ouvertes.
5. Compte dont le changement de mot de passe est imposé : l'écran de changement imposé s'affiche comme avant, formulaire visible, sans chevron (FR-010).

## US3 : carte Données et informations

1. Ouvrir « Mon compte » : la carte « Vos données et informations » ne montre que son titre, sa description et le chevron ; les trois cartes et « Se déconnecter » tiennent dans le premier écran (SC-001).
2. Toucher l'en-tête : les liens (mentions légales, données personnelles, télécharger mes données, licences, nous écrire) et la version apparaissent avec la même animation.
3. Ouvrir « Mentions légales », revenir : la carte est toujours dépliée.
4. Mode avion : la carte se déplie ; « Télécharger mes données » reste désactivé, les pages légales s'ouvrent.

## US4 : catégories de l'onglet Idées

1. Ouvrir « Nos envies toute l'année » : les catégories sont repliées.
2. Toucher « Maison » : elle se déplie avec la même animation que les cartes du compte, le chevron pivote, « Lampe de lecture » apparaît.
3. Déplier « Cuisine » : « Maison » reste ouverte. Retoucher « Maison » : elle se replie avec l'animation.
4. Réordonner avec les flèches une catégorie dépliée : elle garde son état à sa nouvelle place.
5. « Réduire les animations » actif : les catégories s'ouvrent sans mouvement.
6. « Mon compte » › « Licences » : toucher le nom d'un logiciel déplie son texte avec la même animation ; le retoucher le replie.

## Non-régression

- Site : la page `/compte` est inchangée.
- Parcours `005-us5`, `006-us2`, `006-us3`, `006-us4` (écran de compte) et `005-us3` (catégories) toujours verts.
- Téléphone en anglais : « Profile » / « Change password », indices « Expand » / « Collapse ».
