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

Données locales : `data/wishlist.json` (créé au premier lancement).

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
| `WISHLIST_DATA_PATH` | non | Chemin du JSON (défaut `data/wishlist.json`) |
| `INSTANCE_CONTENT_PATH` | non | JSON privé personnalisant la page projet |
| `RESEND_API_KEY` | non | Envoi d’e-mails |
| `MAIL_FROM` | non | Expéditeur Resend, ex. `Oh, You Shouldn't! <noreply@domaine.fr>` |
| `PASSWORD_RESET_SHOW_LINK` | non | `1` = affiche le lien reset dans l’UI si mail KO (dev) |
| `GEMINI_API_KEY` | non | Enrichissement URL (prioritaire si les deux clés sont set) |
| `OPENAI_API_KEY` | non | Enrichissement URL (fallback) |
| `GEMINI_MODEL` / `OPENAI_MODEL` | non | Override modèles |
| `API_ALLOWED_ORIGINS` | non | Origines web autorisées à appeler l’API (`/api/v1`), séparées par des virgules, ex. `capacitor://localhost,https://localhost`. Sans elle : seuls le site et les clients natifs appellent l’API |

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

Persistance : volume `WHISHLIST_DATA_DIR` → `/data/wishlist.json` dans le conteneur (`user 1000:1000`). Le JSON est écrit en mode `0600` (owner only) quand le FS le permet.

Ops Mac mini : `deploy/harden-data.sh`, `deploy/backup-whishlist.sh` (AES si `WHISHLIST_BACKUP_PASSPHRASE`), `deploy/ops-check.sh` — détails dans [`deploy/DEPLOY-RUNTIPI.md`](deploy/DEPLOY-RUNTIPI.md).

### 4. Smoke

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8740/
```

Attendu : `200`.

### Mise à jour

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
