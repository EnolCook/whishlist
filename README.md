# Oh, mais fallait pas ! / Oh, You Shouldn't!

Listes de cadeaux partagées (`ohyoushouldnt.app`) : lecture publique sans compte, édition à plusieurs avec compte, réservations anonymes (« J’offre »), catégories / « qui », archives, i18n FR/EN, enrichissement produit depuis une URL (Gemini / OpenAI).

Stack : **Next.js 16** (App Router) · **React 19** · stock JSON fichier · Docker standalone.

---

## Prérequis

- Node **≥ 20** (dev local)
- Docker (déploiement recommandé)
- Un secret de session (≥ 32 caractères aléatoires)

Optionnel :

- [Resend](https://resend.com) — mails (reset MDP, invitations)
- Clé **Gemini** ou **OpenAI** — bouton « Récupérer les infos » sur un lien produit

---

## Démarrage local

```bash
git clone https://github.com/cloeduc/whishlist.git
cd whishlist
cp .env.example .env
# Éditer .env : au minimum SESSION_SECRET=...
npm ci
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

```bash
npm test          # tests domaine
npm run build     # build prod local
```

Données locales : base SQLite `data/wishlist.db` (créée au premier lancement). Un ancien `data/wishlist.json` est importé une fois au démarrage, puis n'est plus ni lu ni modifié.

### Base de démonstration

Pour tester les parcours ou produire des captures sans utiliser de données réelles :

```bash
npm run demo:data -- tmp/demo-wishlist.json
WISHLIST_DATA_PATH=tmp/demo-wishlist.json npm run dev
```

Comptes fictifs : `alex@example.test` et `camille@example.test`.
`DEMO_PASSWORD` est obligatoire (10 caractères minimum) pour `demo:data` et `demo:capture`.

Captures du guide (FR + EN) :

```bash
DEMO_BASE_URL=http://localhost:3010 npm run demo:capture
```

Les PNG sont écrits dans `public/guide/fr` et `public/guide/en`.

---

## Variables d’environnement

| Variable | Requis | Rôle |
|---|---|---|
| `SESSION_SECRET` | **oui** | Signature des cookies de session |
| `APP_ORIGIN` | prod | URL publique (`https://ohyoushouldnt.app`) pour mails / liens de partage |
| `SUPPORT_URL` | non | Payment Link Stripe (« Soutenir le projet ») |
| `WISHLIST_DATA_PATH` | non | Chemin de l'ancien JSON, importé une fois (défaut `data/wishlist.json`) ; la base SQLite est à côté, en `.db` |
| `INSTANCE_CONTENT_PATH` | non | JSON privé personnalisant la page projet |
| `RESEND_API_KEY` | non | Envoi d’e-mails |
| `MAIL_FROM` | non | Expéditeur Resend, ex. `Oh, You Shouldn't! <noreply@domaine.fr>` |
| `PASSWORD_RESET_SHOW_LINK` | non | `1` = affiche le lien reset dans l’UI si mail KO (dev) |
| `MAIL_SMTP_URL` | non | `smtp://localhost:1025` = e-mails envoyés à ce serveur SMTP (MailDev, suite e2e) au lieu de Resend ; dev uniquement, ignorée en production |
| `MAIL_DRY_RUN` | non | `1` = e-mails écrits dans `data/mail.log` au lieu de partir, validation des adresses active (dev uniquement, ignorée en production) |
| `GEMINI_API_KEY` | non | Enrichissement URL (prioritaire si les deux clés sont set) |
| `OPENAI_API_KEY` | non | Enrichissement URL (fallback) |
| `GEMINI_MODEL` / `OPENAI_MODEL` | non | Override modèles |
| `API_ALLOWED_ORIGINS` | non | Origines web autorisées à appeler l’API (`/api/v1`), séparées par des virgules, ex. `capacitor://localhost,https://localhost`. Sans elle : seuls le site et les clients natifs appellent l’API |
| `APPLE_TEAM_ID` | non | Identifiant d'équipe Apple (10 caractères) : sert `/.well-known/apple-app-site-association`, pour que les liens du site ouvrent l'app iOS. Sans elle : 404, les liens ouvrent le site |
| `ANDROID_CERT_SHA256` | non | Empreintes SHA-256 des certificats de signature de l'app Android (Play Console), séparées par des virgules : sert `/.well-known/assetlinks.json`. Sans elle : 404, les liens ouvrent le site |
| `APP_STORE_URL` | non | Fiche de l'app sur l'App Store (`https://apps.apple.com/…`) : badge de la fenêtre « l'app sur votre téléphone » du site. Sans elle : pas de badge App Store |
| `PLAY_STORE_URL` | non | Fiche de l'app sur Google Play (`https://play.google.com/…`). Sans elle : pas de badge Google Play ; sans aucune des deux, l'icône de téléphone n'apparaît pas |

En Docker / compose, les mêmes valeurs sont souvent préfixées `WHISHLIST_*` dans le fichier env hôte (voir `deploy/compose.prod.yml`).

---

## Déploiement Docker (chemin simple)

### 1. Build

```bash
docker build -t whishlist:local .
```

### 2. Fichier env

```bash
mkdir -p ./data-prod
cat > whishlist.env <<'EOF'
WHISHLIST_SESSION_SECRET=change-moi-par-une-longue-chaine-aleatoire
WHISHLIST_APP_ORIGIN=https://ohyoushouldnt.app
# WHISHLIST_RESEND_API_KEY=re_...
# WHISHLIST_MAIL_FROM=Oh, You Shouldn't! <noreply@exemple.fr>
# WHISHLIST_GEMINI_API_KEY=...
# WHISHLIST_OPENAI_API_KEY=...
EOF
```

### 3. Lancer

```bash
WHISHLIST_DATA_DIR=./data-prod docker compose \
  -f deploy/compose.prod.yml \
  --env-file whishlist.env \
  up -d
```

App sur **http://localhost:8740** (port hôte configurable dans `deploy/compose.prod.yml`).

Persistance : volume `WHISHLIST_DATA_DIR` → base SQLite `/data/wishlist.db` (mode WAL, avec `wishlist.db-wal` et `wishlist.db-shm`) dans le conteneur (`user 1000:1000`), en mode `0600` (owner only) quand le FS le permet. Ne copiez pas `wishlist.db` à la main pendant que le conteneur tourne : passez par la sauvegarde à chaud ci-dessous.

Ops Mac mini : `deploy/harden-data.sh`, `deploy/backup-whishlist.sh` (AES si `WHISHLIST_BACKUP_PASSPHRASE`), `deploy/ops-check.sh` — détails dans [`deploy/DEPLOY-RUNTIPI.md`](deploy/DEPLOY-RUNTIPI.md).

Variables des scripts d'exploitation (lues sur l'hôte, pas par l'app) :

| Variable | Défaut | Rôle |
|---|---|---|
| `WHISHLIST_DATA_DIR` | `~/webserver/data/whishlist` | Dossier hôte du volume `/data` |
| `WHISHLIST_BACKUP_DIR` | `~/webserver/backups/whishlist` | Dossier des sauvegardes |
| `WHISHLIST_BACKUP_KEEP` | `14` | Jours de sauvegardes gardés |
| `WHISHLIST_BACKUP_PASSPHRASE` | — | Chiffre les sauvegardes (AES) si présente |
| `WHISHLIST_CONTAINER` | `whishlist` | Conteneur où lancer la sauvegarde à chaud |
| `WHISHLIST_ENV_FILE` | `~/webserver/data/whishlist.env` | Fichier env vérifié par `harden-data.sh` et `ops-check.sh` |
| `WHISHLIST_NTFY_TOPIC` | — | Topic ntfy qui reçoit une alerte si la sauvegarde échoue ; sans elle, aucune notification |
| `WHISHLIST_NTFY_URL` | `http://127.0.0.1:8166` | Serveur ntfy |
| `WHISHLIST_NTFY_TOKEN_FILE` | `~/webserver/data/whishlist.ntfy-token` | Jeton d'accès ntfy (`tk_…`), lu seulement si le fichier existe ; mode `600` |

Sauvegarde à chaud, sans arrêter le service :

```bash
docker exec whishlist node scripts/db-backup.mjs /data/.backup-manuel.db
# puis copier ./data-prod/.backup-manuel.db ailleurs et le supprimer du volume
```

Restauration et retour à la version précédente : voir [`deploy/DEPLOY-RUNTIPI.md`](deploy/DEPLOY-RUNTIPI.md), « Restauration ».

### 4. Smoke

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8740/
```

Attendu : `200`.

### Mise à jour

Première mise à jour vers la version SQLite (le volume contient encore `wishlist.json`) : faire une copie de `wishlist.json` hors du volume, puis vérifier cette copie avec `npm run db:check -- <copie>` (« aucun problème » attendu) avant de reconstruire. Au démarrage, le journal du conteneur affiche `[store] ancien fichier importé : …` ; si le fichier est incohérent, le conteneur s'arrête en nommant les enregistrements fautifs, sans rien modifier.

```bash
git pull
docker build -t whishlist:local .
WHISHLIST_DATA_DIR=./data-prod docker compose \
  -f deploy/compose.prod.yml \
  --env-file whishlist.env \
  up -d --force-recreate --pull never
```

---

## Derrière un reverse proxy / tunnel

Expose le port **8740** (ou celui que tu as choisi) en HTTPS.

Exemple Cloudflare Tunnel : hostname public → `http://127.0.0.1:8740`.

Sur le Mac mini de prod, le script tout-en-un est :

```bash
bash deploy/bootstrap-mini.sh
```

Détails Runtipi + Cloudflare : [`deploy/DEPLOY-RUNTIPI.md`](deploy/DEPLOY-RUNTIPI.md).

---

## Premiers pas après install

1. Ouvre l’URL → **Inscription**
2. Crée une liste vide, ajoute des idées
3. **Partage** : copie le lien de lecture (`/l/...`) ; invitation / e-mail pour co-éditer
4. **Réglages** : catégories et « qui » en chips ; suppression de liste
5. Langue : bouton **FR / EN** dans le header (`?lang=en` force l’anglais)

Sans Resend : les liens de reset MDP partent dans `data/password-reset.log` (ou le volume `/data`).

---

## Personnaliser une instance sans modifier le dépôt

Copie `data/instance-content.example.json` vers `data/instance-content.json`, puis
adapte le récit FR/EN et le lien Stripe (supportUrl). Place éventuellement le portrait dans
`public/instance/portrait.png`.

Ces deux chemins sont ignorés par Git. Sans eux, la page `/projet` affiche le
contenu générique du dépôt. `INSTANCE_CONTENT_PATH` permet de placer le JSON
ailleurs en production.

---

## Fonctionnalités (résumé)

| Zone | Contenu |
|---|---|
| Public `/l/[token]` | Filtres qui / budget, « J’offre », lien d’achat, réservations masquées |
| Admin | Kanban par catégorie, archives, réservations, partage, réglages |
| Enrichissement | Scraping OG/JSON-LD + LLM (nom, prix, image, type) |
| Auth | Compte, reset MDP, force changement MDP 1ʳᵉ connexion, invitations |
| API | `/api/v1`, pour une app mobile ou un script (voir ci-dessous) |

---

## API

L’app expose les mêmes parcours que le site sous `/api/v1`, en JSON, pour l’app mobile (`mobile/`). Elle applique les mêmes règles et les mêmes droits que le site.

- Contrat : [`specs/004-mobile-api/contracts/openapi.yaml`](specs/004-mobile-api/contracts/openapi.yaml) (OpenAPI 3.1).
- Connexion : `POST /api/v1/auth/login` rend un jeton, à envoyer ensuite dans `Authorization: Bearer <jeton>` (30 jours, révoqué par `POST /api/v1/auth/logout` ou un changement de mot de passe).
- Sans compte : lecture et réservation par le lien de lecture (`/api/v1/public/lists/<token>`).
- L’API n’utilise aucun cookie. Une page web ne peut l’appeler que depuis le site ou une origine de `API_ALLOWED_ORIGINS`.
- Un client peut choisir l’identifiant de ce qu’il crée (`id` sur `POST /lists` et `POST /lists/{id}/items`, version 1.1.0) : un renvoi ne crée pas de doublon.
- Vérification à la main : [`specs/004-mobile-api/quickstart.md`](specs/004-mobile-api/quickstart.md).

### Clés d’API et assistants IA (MCP)

- Une **clé d’API** se crée sur la page **Mon compte** (section « Clés d’API et assistants IA »). Elle s’affiche une seule fois, commence par `oys_`, et s’envoie comme un jeton : `Authorization: Bearer oys_…`. Elle n’ouvre que le serveur MCP ci-dessous : l’API JSON `/api/v1` la refuse (`403 apiKeyNotAllowed`) et reste aux jetons de session de l’app. Elle agit pour le compte jusqu’à sa révocation ou un changement ou une réinitialisation du mot de passe (toutes les clés du compte sont alors révoquées), 120 requêtes par minute au plus, et ne touche jamais au compte (mot de passe, adresse, export, suppression). Un compte a au plus 20 clés, et en crée au plus 10 par heure. L’export du compte ne contient pas les clés.
- **Serveur MCP** : `POST /api/mcp` (transport Streamable HTTP, sans état), avec la même clé. Outils :
  - listes : `list_lists`, `get_list`, `create_list`, `rename_list`, `delete_list` ;
  - idées : `add_idea`, `update_idea`, `archive_idea`, `delete_idea`, `move_idea`, `copy_idea`, `fill_from_url` (une idée porte aussi sa description et « occasion acceptée », `description` et `secondHandOk`) ;
  - catégories et « qui » : `add_category`, `rename_category`, `delete_category`, `add_person`, `rename_person`, `delete_person`.

  Mêmes règles que le site : une idée réservée ne se supprime ni ne se déplace, une idée ne change de liste qu’entre deux listes dont on est membre, seul le propriétaire supprime une liste, une catégorie ou un « qui » encore utilisé reste. Les outils `delete_*` se déclarent destructifs (`destructiveHint`), pour que l’assistant demande confirmation. Une idée dit seulement si elle est réservée, jamais par qui.
- Exemple avec Claude Code : `claude mcp add --transport http ohyoushouldnt https://<votre-instance>/api/mcp --header "Authorization: Bearer oys_…"`. Les erreurs des règles (liste introuvable, idée réservée…) sont en français par défaut ; pour un assistant en anglais, ajoutez `--header "Accept-Language: en"`.
- Vérification à la main : [`specs/013-api-keys-mcp/quickstart.md`](specs/013-api-keys-mcp/quickstart.md).

---

## App mobile

App Expo (iOS et Android) dans `mobile/`, cliente de l’API : connexion, listes, idées, partage par QR code, et mode hors ligne (copie locale + changements envoyés au retour du réseau). Son design reprend celui du site écran par écran ; ses textes sont lus dans `locales/`.

Elle a son propre `package.json` et ne fait partie ni du build Next, ni de l’image Docker. Elle se lance avec un client de développement (pas Expo Go) :

```bash
npm --prefix mobile ci
# Serveur du site sur la base de démo (voir plus haut), joignable depuis le simulateur
EXPO_PUBLIC_API_URL=http://localhost:3010 npm --prefix mobile run ios       # ou : run android
```

- `EXPO_PUBLIC_API_URL` : adresse du site, fixée au build. Sur l’émulateur Android, `localhost` du Mac est `http://10.0.2.2:<port>`.
- Builds EAS (projet `@tat-lonestone/ohyoushouldnt`, `mobile/eas.json`), deux profils :

  | Profil | Commande | App installée | Usage |
  | --- | --- | --- | --- |
  | `development` | `npm --prefix mobile run build:dev` (APK Android), `build:ios:dev` (simulateur iOS) | « Oh, mais fallait pas ! (Dev) », `app.ohyoushouldnt.mobile.dev` | client de dev : charge le JavaScript depuis Metro (`npm --prefix mobile start`), avec le catalogue de composants |
  | `production` | `npm --prefix mobile run build:prod` (AAB Android, envoyé sur Google Play en test interne), `build:ios:prod` (iOS, envoyé sur TestFlight) | « Oh, mais fallait pas ! », `app.ohyoushouldnt.mobile` | l’app autonome sur `https://ohyoushouldnt.app`, signée par EAS, numéro de build incrémenté par EAS |

  La variante vient de `APP_VARIANT` (`mobile/app.config.ts`) : sans elle, c’est la production, y compris pour `run ios|android` ; `APP_VARIANT=development` devant la commande donne le client de dev en local. Les deux apps s’installent côte à côte. L’app Android passe par Google Play (piste de test interne, clé du compte de service dans `mobile/play-service-account.json`, ignorée par git) ; l’app iOS passe par TestFlight (équipe Apple `JW4X82845H`), sans ad hoc ni appareils enregistrés.
- Vérifications : `npm --prefix mobile run lint`, `typecheck`, `test` ; parcours à la main dans [`specs/005-mobile-list-app/quickstart.md`](specs/005-mobile-list-app/quickstart.md).
- Captures du site en largeur de téléphone (référence de design) : `DEMO_BASE_URL=http://localhost:3010 npm run demo:capture -- --mobile`.

### Liens de l’app

Les liens envoyés par e-mail ou partagés (confirmation d’adresse, réinitialisation, invitation, lien public d’une liste) gardent leur adresse sur le site. Sur un téléphone où l’app est installée (1.1.0 et plus), ils ouvrent l’app ; sinon, le site. La liste des chemins ouverts par l’app est dans `src/site/app-links.ts` (contrat : [`specs/011-app-deep-links/contracts/links.md`](specs/011-app-deep-links/contracts/links.md)).

- Le site publie `/.well-known/apple-app-site-association` et `/.well-known/assetlinks.json` quand `APPLE_TEAM_ID` et `ANDROID_CERT_SHA256` sont réglés (404 sinon) :
  - `APPLE_TEAM_ID` : l’équipe Apple ci-dessus ;
  - `ANDROID_CERT_SHA256` : Play Console → l’app → Intégrité de l’app → Signature de l’app, empreintes SHA-256 de la **clé de signature de l’app** et de la **clé d’importation**, séparées par une virgule.
- L’app ne déclare le domaine que pour un serveur en `https` (`mobile/app.config.ts`) ; un nouveau build natif est nécessaire après un changement de la table des chemins.
- Vérifier après un déploiement : `curl -sI https://ohyoushouldnt.app/.well-known/apple-app-site-association` (200, `application/json`, sans redirection), même chose pour `assetlinks.json` ; le CDN d’Apple (`https://app-site-association.cdn-apple.com/a/v1/ohyoushouldnt.app`) ; sur Android, `adb shell pm get-app-links app.ohyoushouldnt.mobile` doit dire `verified`.
- En local, sans domaine associé, les mêmes chemins s’ouvrent par le schéma de l’app : `xcrun simctl openurl booted "ohyoushouldnt://reinitialiser/<jeton>"`.
- `APP_STORE_URL` et `PLAY_STORE_URL` font apparaître, sur le site consulté depuis un téléphone, l’icône qui propose l’app.

---

## Structure utile

```
app/                  # pages Next
app/api/v1/           # API JSON (adaptateurs, sans règle métier)
mobile/               # app Expo (package séparé)
components/site/      # UI métier
src/domain/           # règles métier (testées)
src/server/commands/  # orchestration partagée par les server actions et l’API
src/store/            # JSON + lock fichier
locales/{fr,en}/      # i18n
deploy/               # compose, bootstrap, Runtipi
data/seed.json        # fixture de test uniquement (pas d’import produit)
```

---

## Licence

[MIT](LICENSE) — Copyright © 2026 Cloé / Mesdames Duc.
