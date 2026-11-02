# Contrat : commande `e2e`

## Invocation

```bash
npm --prefix mobile run e2e -- [--platform ios|android] [--lang fr|en] [<parcours.yaml>…]
```

| Argument | Défaut | Rôle |
|----------|--------|------|
| `--platform` | déduite s'il n'y a qu'un appareil démarré | choisit l'appareil ; obligatoire si un simulateur iOS et un émulateur Android sont démarrés |
| `--lang` | `E2E_LANG`, sinon la langue de l'appareil, sinon `fr` | langue des textes vérifiés (R8) |
| `<parcours.yaml>…` | tous les fichiers de `mobile/.maestro/flows/` | joue seulement ces parcours (US2). Les chemins sont relatifs à `mobile/` ou absolus |

## Variables d'environnement (runner uniquement, R15)

| Variable | Requis | Rôle |
|----------|--------|------|
| `DEMO_PASSWORD` | **oui** | Mot de passe des comptes de démo et des comptes `e2e-*`. Au moins 10 caractères |
| `E2E_API_URL` | non | Serveur local. Défaut `http://localhost:3010`. Doit être `localhost` ou `127.0.0.1` (R4) : `10.0.2.2` n'est l'alias du Mac que vu de l'émulateur |
| `E2E_LANG` | non | `fr` ou `en`, comme `--lang` |
| `E2E_METRO_URL` | non | Build Debug : Metro que le lanceur du dev client rouvre après l'effacement de l'app, passé aux parcours (`METRO_URL`). Défaut `http://localhost:8081` |
| `E2E_MAILDEV_URL` | non | MailDev de la suite (010), passé aux parcours (`MAILDEV_URL`). Défaut `http://localhost:1080`, local seulement |

## Prérequis vérifiés avant le premier parcours (FR-012)

Dans cet ordre. Au premier qui manque, le runner affiche le message et sort avec le code 2.

| Vérification | Message si absent (résumé) |
|--------------|----------------------------|
| `DEMO_PASSWORD` posé, ≥ 10 caractères | « DEMO_PASSWORD est obligatoire (10 caractères minimum). » |
| `maestro` dans le `PATH` | « Maestro est introuvable : curl -Ls https://get.maestro.mobile.dev \| bash » |
| `E2E_API_URL` locale | « E2E_API_URL doit viser un serveur local (localhost ou 127.0.0.1). » |
| `E2E_MAILDEV_URL` locale | « E2E_MAILDEV_URL doit viser un MailDev local (localhost ou 127.0.0.1). » |
| exactement un appareil pour la plateforme demandée | « Aucun simulateur iOS démarré » / « Aucun émulateur Android démarré » / « Plusieurs appareils : précisez --platform » |
| app `app.ohyoushouldnt.mobile` installée | « L'app n'est pas installée sur <appareil> : EXPO_PUBLIC_API_URL=… npx expo run:ios --configuration Release » |
| serveur joignable (`GET /api/v1/capabilities`) | « Serveur injoignable sur <url> : WISHLIST_DATA_PATH=tmp/e2e/wishlist.json npm run dev -- --port 3010 » |
| le serveur lit `tmp/e2e/wishlist.json` (R3) | « Le serveur ne lit pas tmp/e2e/wishlist.json : relancez-le avec WISHLIST_DATA_PATH=tmp/e2e/wishlist.json » |
| MailDev joignable (`GET /api/healthz`), ajouté par la 010 | « MailDev injoignable sur <url> : npx maildev@3.0.0 --smtp 1025 --web 1080 » |
| le serveur envoie ses e-mails (`mail` de `/capabilities`) | « Le serveur n'envoie pas d'e-mails : relancez-le avec MAIL_SMTP_URL=smtp://localhost:1025 » |

## Étapes

1. Vérifier les prérequis jusqu'à l'appareil et l'app (tableau ci-dessus).
2. Régénérer `tmp/e2e/wishlist.json` : script de démo vers un fichier temporaire, puis renommage.
3. Vérifier le serveur, puis vérifier qu'il lit le fichier : connexion d'Alex par l'API, recherche de la nouvelle session dans le fichier, déconnexion.
4. Vider la boîte de MailDev (`DELETE /api/email/all`) : un parcours ne lit jamais le lien d'une exécution précédente.
5. Android : `adb reverse tcp:<port> tcp:<port>` (R10).
6. Écrire `mobile/.maestro/scripts/strings.generated.js` pour la langue choisie.
7. Lancer :
   ```text
   maestro test --device <id> --format junit --output <dir>/report.xml --test-output-dir <dir>
                [--exclude-tags android-only] <config ou parcours>
                    # DEMO_PASSWORD passé par l'environnement : MAESTRO_DEMO_PASSWORD
   ```
8. Lire `report.xml`, puis afficher et écrire `summary.txt`.

## Sortie

```text
Parcours e2e — ios — fr — 2026-11-02 14:03
  ✓ 005 US1 — Se connecter ou créer un compte          41 s
  ✗ 005 US3 — Remplir une liste                        28 s
      étape : Assert that id: items.new.submit is visible
  – 005 US5 — Continuer sans réseau                    non joué : le simulateur iOS ne permet pas de couper le réseau de l'app
  ✓ 006 US1 — Supprimer son compte                     35 s
  …
7 réussis, 1 échoué, 1 non joué — résultats : tmp/e2e/results/20261102-140312-ios/
```

| Code | Sens |
|------|------|
| 0 | aucun parcours en échec (les « non joué » ne comptent pas comme des échecs) |
| 1 | au moins un parcours en échec |
| 2 | prérequis manquant, aucun parcours joué |

Le mot de passe n'apparaît ni dans la sortie ni dans `summary.txt`.
