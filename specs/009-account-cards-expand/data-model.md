# Data Model: Cartes repliables sur l'écran de compte de l'app

Aucune donnée persistée, ni sur le serveur, ni dans la base locale de l'app, ni dans l'API. Seul un état d'affichage existe.

## État d'une carte repliable

| Champ | Type | Défaut | Règle |
| --- | --- | --- | --- |
| `expanded` | booléen | `false` | Bascule à chaque appui sur l'en-tête. Local au composant : chaque ouverture de l'écran repart de `false`. |
| `progress` | valeur animée 0 → 1 | `0` | Suit `expanded` en 200 ms ; saute directement à 0 ou 1 si « réduire les animations » est actif. |
| `contentHeight` | nombre | `0` | Hauteur naturelle du contenu, mesurée ; mise à jour quand le contenu change (alerte qui apparaît). |

## Transitions

```text
replié ──(appui en-tête)──▶ dépliée     contenu visible, lisible, atteignable
dépliée ──(appui en-tête)──▶ replié     clavier fermé, contenu caché aux lecteurs d'écran
```

Les trois cartes (Profil, Mot de passe, Données et informations) ont chacune leur état ; elles ne se replient pas les unes les autres. Revenir d'une page ouverte depuis l'écran garde l'état (l'écran reste monté). Un appui dans le contenu ne change pas l'état. Des appuis rapides relancent l'animation vers la dernière valeur demandée.
