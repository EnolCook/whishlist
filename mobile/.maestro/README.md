# Suite e2e de l'app mobile

Des parcours [Maestro](https://docs.maestro.dev), un par user story de l'app mobile, joués sur un simulateur iOS ou un émulateur Android contre le serveur local. Ce qui reste manuel est listé dans [exclusions.md](exclusions.md). Le contrat complet de la commande est dans [specs/007-mobile-e2e-maestro/contracts/e2e-command.md](../../specs/007-mobile-e2e-maestro/contracts/e2e-command.md).

## Prérequis

```bash
# 1. Maestro (hors dépôt)
curl -Ls https://get.maestro.mobile.dev | bash

# 2. MailDev, la boîte de réception de la suite : les parcours y lisent les liens de confirmation d'adresse
#    (010). La commande e2e la vide avant chaque exécution.
npx maildev@3.0.0 --smtp 1025 --web 1080

# 3. Serveur local sur la base de la suite (tmp/e2e/wishlist.db), qui envoie ses e-mails à MailDev
#    (MAIL_SMTP_URL, ignorée en production). La commande e2e remplace la base à chaque exécution, en une
#    transaction ; le serveur la relit à chaque requête, sans redémarrer. Sans GEMINI_API_KEY ni OPENAI_API_KEY.
export DEMO_PASSWORD='demo-password-1'
npm run demo:data -- tmp/e2e/wishlist.json
MAIL_SMTP_URL=smtp://localhost:1025 WISHLIST_DATA_PATH=tmp/e2e/wishlist.json SESSION_SECRET=dev-secret-dev-secret-dev-secret-00 npm run dev -- --port 3010

# 4. App pointée sur ce serveur, au choix :
#    - build Debug avec son Metro (pratique pour retoucher les écrans sans rebuild) ;
#      la suite rouvre Metro après chaque effacement de l'app : E2E_METRO_URL=http://localhost:8082
(cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3010 npx expo run:ios --port 8082)
#    - build Release (pas de Metro, pas d'avertissement par-dessus l'écran)
(cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3010 npx expo run:ios --configuration Release)
# Android : … npx expo run:android (--variant release)
```

La validation des adresses est donc active pendant la suite : `subflows/register.yaml` confirme l'adresse du compte qu'il crée (lien lu dans MailDev par `scripts/maildev-link.js`, ouvert dans le navigateur du simulateur, bouton « Confirmer », retour à l'app), et `subflows/register-unconfirmed.yaml` s'arrête avant, pour les parcours de la 010.

En build Debug, l'app contient le lanceur du dev client. Après l'effacement de l'app, `subflows/launch-clean.yaml` rouvre Metro par le lien du dev client, confirme « Ouvrir » et ferme le menu développeur.

Sur iOS, `submit-register.yaml` ferme la feuille « Utiliser un mot de passe robuste ? » en appuyant sur la position de sa croix : cette feuille du système est invisible pour Maestro. Les sous-parcours refusent aussi « Enregistrer le mot de passe ? » (« Plus tard »).

Laissez le Mac branché et capot ouvert pendant la suite : une mise en veille coupe Maestro (« Device became unreachable »).

Next 16 n'autorise qu'un `next dev` par projet : si `npm run dev` tourne déjà sur une autre base, arrêtez-le, puis relancez-le avec la commande ci-dessus.

## Lancer

```bash
DEMO_PASSWORD=… npm --prefix mobile run e2e                                    # toute la suite
DEMO_PASSWORD=… npm --prefix mobile run e2e -- .maestro/flows/005-us1-auth.yaml # un parcours
DEMO_PASSWORD=… npm --prefix mobile run e2e -- --platform android --lang en
```

- `--platform` est obligatoire seulement si un simulateur iOS et un émulateur Android sont démarrés ensemble.
- `--lang` choisit la langue des textes vérifiés. Par défaut, c'est celle de l'appareil, comme l'app.
- Avant le premier parcours, la commande vérifie les prérequis. S'il en manque un, elle s'arrête avec le code 2 et dit quoi faire.
- Elle se termine avec le code 0 si aucun parcours n'a échoué, et 1 sinon.
- Un parcours « non joué » (hors ligne sur iOS) ne compte pas comme un échec.

| Variable | Requis | Rôle |
|----------|--------|------|
| `DEMO_PASSWORD` | oui | Mot de passe des comptes de démo et des comptes `e2e-*` créés par les parcours |
| `E2E_API_URL` | non | Serveur local, `http://localhost:3010` par défaut. Seuls `localhost` et `127.0.0.1` sont acceptés : la commande tourne sur le Mac, et l'émulateur Android joint ce port par `adb reverse` |
| `E2E_LANG` | non | `fr` ou `en`, comme `--lang` |
| `E2E_MAILDEV_URL` | non | MailDev de la suite, `http://localhost:1080` par défaut (local seulement). La commande vérifie qu'il répond et que le serveur envoie ses e-mails (`mail` de `/capabilities`), puis vide sa boîte |
| `E2E_METRO_URL` | non | Build Debug seulement : Metro que le lanceur du dev client rouvre après chaque effacement de l'app. Défaut `http://localhost:8081` |

`MAIL_SMTP_URL` configure le serveur, pas la commande : elle est dans le tableau du `README.md` du serveur.

Ces variables ne servent qu'à la commande e2e : elles ne vont ni dans le `README.md` du serveur, ni dans `.env.example`, ni dans `deploy/compose.prod.yml`.

## Résultats

Chaque exécution écrit dans `tmp/e2e/results/<date>-<plateforme>/` :

- `summary.txt` : le résumé affiché, une ligne par parcours ;
- `report.xml` : le rapport JUnit de Maestro ;
- les journaux de Maestro, et la capture de l'écran au moment d'un échec.

## Écrire un parcours

Un fichier par user story, dans `flows/<feature>-us<N>-<slug>.yaml` :

```yaml
appId: app.ohyoushouldnt.mobile
name: "008 US1 — Titre de la story"
tags:
  - 008-us1            # exactement un tag de story ; ajouter android-only si le parcours ne peut pas tourner sur iOS
---
- runFlow: ../subflows/launch-clean.yaml            # toujours en premier : app vide, trousseau iOS vidé
- runScript: ../scripts/strings.generated.js        # textes attendus : output.t.<namespace>.<clé>
- runScript: ../scripts/unique.js                   # output.unique, pour nommer ce que le parcours crée
- runFlow:
    file: ../subflows/login.yaml
    env:
      EMAIL: alex@example.test
- tapOn:
    id: lists.new
- assertVisible: ${output.t.errors.invalidCredentials}
```

Règles :

- **Agir par identifiant.** Toute action vise un `testID` (`id:`), jamais un texte d'interface.
- **Nommer les identifiants `<écran>.<élément>`**, par exemple `login.email` ou `item-form.submit`. Chaque écran a `<écran>.screen` sur son conteneur. Un identifiant dynamique prend un préfixe fixe, par exemple `` `lists.card-${list.id}` ``.
- **Vérifier les messages avec `output.t`.** Les textes viennent des fichiers `locales/` : une reformulation ne casse rien, et la suite marche en anglais. Les textes à variable n'y sont pas, il faut passer par un `testID`.
- **Créer ce qu'on détruit.** Un parcours qui supprime quelque chose l'a créé lui-même, nommé avec `output.unique`. Un compte qu'on supprime vient de `subflows/register.yaml`.
- **Ne pas attendre une durée fixe.** Utiliser `extendedWaitUntil`.
- **Aucun mot de passe en clair.** Utiliser `${MAESTRO_DEMO_PASSWORD}` : la commande le passe à Maestro par l'environnement, jamais en argument de processus. N'utiliser que des adresses `@example.test`.
- **Prouver le serveur avant d'écrire.** Un parcours commence par `login.yaml` (qui vérifie la liste de démo, présente seulement dans la base de la suite) ou par `register.yaml` (qui fait cette vérification avant de créer le compte). Une app compilée vers un autre serveur s'arrête donc avant toute écriture.

Sous-parcours disponibles dans `subflows/` :

| Sous-parcours | Rôle |
|---------------|------|
| `launch-clean` | lance l'app vide |
| `login` | connexion d'un compte de démo (`EMAIL`), avec la preuve du serveur local |
| `submit-login` | remplit et envoie la connexion (`EMAIL`, `PASSWORD`), sans attendre d'écran |
| `register` | crée un compte `e2e-…`, dont l'adresse est dans `output.email`, et confirme cette adresse |
| `register-unconfirmed` | comme `register`, sans confirmer l'adresse (rappel affiché, création de liste bloquée) |
| `confirm-email` | ouvre le dernier lien de confirmation reçu par `TO` dans MailDev, appuie sur « Confirmer », attend `DONE`, revient à l'app |
| `submit-register` | remplit et envoie l'inscription (`NAME`, `EMAIL`), sans attendre d'écran |
| `logout` | déconnexion |
| `create-list` | crée une liste (`TITLE`) |
| `fill-new-list` / `submit-new-list` | remplit catégorie et « Pour qui ? », puis envoie « Créer une liste » |
| `add-item` | ajoute une idée (`NAME`) |
| `open-new-item` / `submit-item-form` | ouvre le formulaire d'idée, puis l'envoie |
| `open-category` | déplie une catégorie (`CATEGORY`, `ITEM`) |
| `close-share-sheet` | referme la feuille de partage du système |

`npm --prefix mobile test` vérifie deux choses sans simulateur :

- chaque `id:` d'un parcours existe dans l'app (`__tests__/e2e/test-ids.test.ts`) ;
- chaque user story des features 005 et 006 a son parcours ou une ligne « story entière » dans `exclusions.md` (`__tests__/e2e/coverage.test.ts`).
