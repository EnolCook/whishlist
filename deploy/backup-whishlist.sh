#!/usr/bin/env bash
# Backup quotidien de la base SQLite Oh, You Shouldn't!.
# - Copie cohérente à chaud, faite dans le conteneur (scripts/db-backup.mjs), sans arrêter le service
# - Copie datée mode 600, chiffrée AES si WHISHLIST_BACKUP_PASSPHRASE est set (openssl)
# - Conserve WHISHLIST_BACKUP_KEEP jours (défaut 14), anciens backups JSON compris
# - Un échec envoie une notification ntfy (deploy/notify.sh, si WHISHLIST_NTFY_TOPIC est set)
set -euo pipefail

DATA_DIR="${WHISHLIST_DATA_DIR:-$HOME/webserver/data/whishlist}"
BACKUP_ROOT="${WHISHLIST_BACKUP_DIR:-$HOME/webserver/backups/whishlist}"
KEEP="${WHISHLIST_BACKUP_KEEP:-14}"
CONTAINER="${WHISHLIST_CONTAINER:-whishlist}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP_NAME=".backup-$STAMP.db"
SRC="$DATA_DIR/$TMP_NAME"

NOTIFY="$(cd "$(dirname "$0")" && pwd)/notify.sh"
step="vérification de la base"

on_exit() {
  local status=$?
  rm -f "$SRC"
  if [[ $status -ne 0 ]]; then
    bash "$NOTIFY" "Sauvegarde whishlist en échec" \
      "Étape : $step (code $status), $(hostname) à $(date '+%d/%m %H:%M'). Détail dans le cron.log des sauvegardes." high
  fi
  exit "$status"
}
trap on_exit EXIT

if [[ ! -f "$DATA_DIR/wishlist.db" ]]; then
  echo "missing $DATA_DIR/wishlist.db" >&2
  exit 1
fi

step="copie à chaud dans le conteneur $CONTAINER"
docker exec "$CONTAINER" node scripts/db-backup.mjs "/data/$TMP_NAME"

step="chiffrement et copie vers $BACKUP_ROOT"

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

if [[ -n "${WHISHLIST_BACKUP_PASSPHRASE:-}" ]]; then
  OUT="$BACKUP_ROOT/wishlist-$STAMP.db.enc"
  openssl enc -aes-256-cbc -pbkdf2 -salt \
    -pass env:WHISHLIST_BACKUP_PASSPHRASE \
    -in "$SRC" -out "$OUT"
  chmod 600 "$OUT"
  echo "encrypted backup: $OUT"
else
  OUT="$BACKUP_ROOT/wishlist-$STAMP.db"
  cp "$SRC" "$OUT"
  chmod 600 "$OUT"
  echo "plain backup: $OUT (set WHISHLIST_BACKUP_PASSPHRASE to encrypt)"
fi

# Rétention
step="rétention"
find "$BACKUP_ROOT" -type f \( -name 'wishlist-*.json' -o -name 'wishlist-*.json.enc' \
  -o -name 'wishlist-*.db' -o -name 'wishlist-*.db.enc' \) -mtime +"$KEEP" -delete

echo "keep=${KEEP}d — $(find "$BACKUP_ROOT" -type f | wc -l) file(s)"
