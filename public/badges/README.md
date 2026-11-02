# Badges des stores

Visuels officiels, non modifiés, de la fenêtre « l'app sur votre téléphone » du site (feature 011, US3).

| Fichier | Source (2026-11-02) |
| --- | --- |
| `fr/app-store.svg`, `en/app-store.svg` | Apple, App Store Marketing Tools : `https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/{fr-fr,en-us}` |
| `fr/google-play.png`, `en/google-play.png` | Google Play badges : `https://play.google.com/intl/en_us/badges/static/images/badges/{fr,en}_badge_web_generic.png` |

Règles d'usage à respecter :

- Apple ([App Store Marketing Guidelines](https://developer.apple.com/app-store/marketing/guidelines/)) : badge non modifié, dans la langue de la page, assez grand (40 px de haut au moins à l'écran), avec un espace libre autour, et pas plus visible que l'identité du site.
- Google ([Google Play badge guidelines](https://partnermarketinghub.withgoogle.com/brands/google-play/visual-identity/badge-guidelines/)) : badge non modifié, lien vers la fiche de l'app sur Google Play, et mention « Google Play et le logo Google Play sont des marques de Google LLC. » à proximité.

Le PNG de Google contient une marge transparente : à la même hauteur que le badge Apple, il paraît plus petit ; le composant `components/site/get-app-button.tsx` compense par sa hauteur.
