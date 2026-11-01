# Déployer Oh, You Shouldn't! — Mac mini + Runtipi + Cloudflare

> Déploiement générique (Docker, env, smoke) : voir le [README racine](../README.md).

Domaine : `ohyoushouldnt.app`  
Port hôte : `8740`

## 0. Avant le Mac mini

Le dépôt Git doit contenir la version à déployer.

Synchroniser aussi `deploy/runtipi/whishlist/` vers `apps/whishlist/` du store
`cloeduc/mesdamesduc-tipi-store`, puis pousser ce store.

## 1. Construire l’image sur le Mac mini

```bash
mkdir -p ~/webserver/repos ~/webserver/data/whishlist
cd ~/webserver/repos
git clone https://github.com/cloeduc/whishlist.git
cd whishlist
docker build --pull -t whishlist:local .
```

## 2. Installer via Runtipi (UI)

Settings → App Stores → `mesdamesduc` → Update → Oh, You Shouldn't! → Install :

- image : `whishlist:local`
- URL : `https://ohyoushouldnt.app`
- secrets session : générés par Runtipi
- Resend / MAIL_FROM : optionnels

## 3. Ou démarrage direct (compose)

```bash
cd ~/webserver/repos/whishlist
cp deploy/compose.prod.yml ~/webserver/repos/whishlist/
# écrire ~/webserver/data/whishlist.env (SESSION + Resend)
export $(grep -v '^#' ~/webserver/data/whishlist.env | xargs)
WHISHLIST_DATA_DIR=$HOME/webserver/data/whishlist \
  docker compose -f deploy/compose.prod.yml --env-file ~/webserver/data/whishlist.env up -d
```

## 4. Cloudflare tunnel

```bash
cloudflared tunnel route dns immich-tunnel ohyoushouldnt.app
# puis ajouter dans /etc/cloudflared/config.yml :
#   - hostname: ohyoushouldnt.app
#     service: http://127.0.0.1:8740
# restart cloudflared
```

## 5. Smoke / ops

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -H "Host: ohyoushouldnt.app" http://127.0.0.1:8740/
curl -sSI https://ohyoushouldnt.app
bash deploy/ops-check.sh
```

### Permissions data

```bash
bash deploy/harden-data.sh
```

Env `~/webserver/data/whishlist.env` → `600`. Volume data → `700`, `wishlist.db`, `wishlist.db-wal`, `wishlist.db-shm` (et l'ancien `wishlist.json`) → `600`.

### Passage à SQLite (première mise à jour depuis le JSON)

```bash
# 1. copie de l'ancien fichier hors du volume
cp -a ~/webserver/data/whishlist/wishlist.json ~/webserver/backups/whishlist/wishlist-avant-sqlite.json
# 2. contrôle à blanc de la copie (attendu : « aucun problème »)
cd ~/webserver/repos/whishlist && npm ci && npm run db:check -- ~/webserver/backups/whishlist/wishlist-avant-sqlite.json
# 3. build et redémarrage habituels, puis lire le journal
docker build --pull -t whishlist:local .
docker compose -f deploy/compose.prod.yml --env-file ~/webserver/data/whishlist.env up -d --force-recreate --pull never
docker logs whishlist 2>&1 | grep '\[store\]'   # « ancien fichier importé : N comptes, … »
bash deploy/harden-data.sh && bash deploy/ops-check.sh
```

Au premier démarrage, l'app importe `wishlist.json` dans `wishlist.db` (tout ou rien), puis ne lit ni ne modifie plus le JSON. Si le fichier est incohérent, le conteneur s'arrête avec la liste des enregistrements fautifs (identifiants seulement) et ne crée pas de base.

### Backup chiffré (cron)

`deploy/backup-whishlist.sh` fait une copie cohérente à chaud **dans le conteneur** (`docker exec whishlist node scripts/db-backup.mjs`), la chiffre si `WHISHLIST_BACKUP_PASSPHRASE` est set, puis la supprime du volume. Variables du script : `WHISHLIST_DATA_DIR`, `WHISHLIST_BACKUP_DIR`, `WHISHLIST_BACKUP_KEEP` (jours, défaut 14), `WHISHLIST_CONTAINER` (défaut `whishlist`).

```bash
# une fois
mkdir -p ~/webserver/backups/whishlist
chmod 700 ~/webserver/backups/whishlist
# passphrase longue dans un fichier 600 (pas dans le repo)
echo '…' > ~/webserver/data/whishlist.backup.pass
chmod 600 ~/webserver/data/whishlist.backup.pass

# cron quotidien 03:15
# 15 3 * * * WHISHLIST_BACKUP_PASSPHRASE="$(cat $HOME/webserver/data/whishlist.backup.pass)" \
#   $HOME/webserver/repos/whishlist/deploy/backup-whishlist.sh >>$HOME/webserver/backups/whishlist/cron.log 2>&1
```

Ne copiez pas `wishlist.db` à la main pendant que le conteneur tourne : une copie prise pendant une écriture peut être inutilisable.

### Restauration

```bash
docker stop whishlist
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:WHISHLIST_BACKUP_PASSPHRASE \
  -in ~/webserver/backups/whishlist/wishlist-….db.enc \
  -out ~/webserver/data/whishlist/wishlist.db
rm -f ~/webserver/data/whishlist/wishlist.db-wal ~/webserver/data/whishlist/wishlist.db-shm
bash deploy/harden-data.sh
docker start whishlist
```

Une sauvegarde non chiffrée (`wishlist-….db`) se copie directement à la place de `wishlist.db`. Les anciennes sauvegardes `wishlist-….json(.enc)` ne se restaurent qu'avec une version antérieure à SQLite (ci-dessous).

### Retour à la version précédente (avant SQLite)

Seulement si la mise à jour vers SQLite se passe mal. L'ancien `wishlist.json` n'a pas été modifié par l'import :

```bash
docker stop whishlist
git checkout <commit d'avant SQLite> && docker build -t whishlist:local .
mv ~/webserver/data/whishlist/wishlist.db ~/webserver/backups/whishlist/wishlist-abandon.db
rm -f ~/webserver/data/whishlist/wishlist.db-wal ~/webserver/data/whishlist/wishlist.db-shm
docker compose -f deploy/compose.prod.yml --env-file ~/webserver/data/whishlist.env up -d --force-recreate --pull never
```

**Tout ce qui a été fait depuis la mise à jour (comptes, listes, idées, réservations) est perdu** : l'ancienne version repart du JSON tel qu'il était avant l'import.

### Env requis (prod)

| Clé | Rôle |
|---|---|
| `WHISHLIST_SESSION_SECRET` | cookies |
| `WHISHLIST_APP_ORIGIN` | `https://ohyoushouldnt.app` |
| `WHISHLIST_RESEND_API_KEY` + `WHISHLIST_MAIL_FROM` | reset / invite |
| `WHISHLIST_GEMINI_API_KEY` | enrich (optionnel) |
