#!/usr/bin/env bash
# Backup quotidien de la base SQLite Oh, You Shouldn't!.
# - Copie cohérente à chaud, faite dans le conteneur (scripts/db-backup.mjs), sans arrêter le service
# - Copie datée mode 600, chiffrée AES si WHISHLIST_BACKUP_PASSPHRASE est set (openssl)
# - Conserve WHISHLIST_BACKUP_KEEP jours (défaut 14), anciens backups JSON compris
set -euo pipefail

DATA_DIR="${WHISHLIST_DATA_DIR:-$HOME/webserver/data/whishlist}"
BACKUP_ROOT="${WHISHLIST_BACKUP_DIR:-$HOME/webserver/backups/whishlist}"
KEEP="${WHISHLIST_BACKUP_KEEP:-14}"
CONTAINER="${WHISHLIST_CONTAINER:-whishlist}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP_NAME=".backup-$STAMP.db"
SRC="$DATA_DIR/$TMP_NAME"

if [[ ! -f "$DATA_DIR/wishlist.db" ]]; then
  echo "missing $DATA_DIR/wishlist.db" >&2
  exit 1
fi

trap 'rm -f "$SRC"' EXIT
docker exec "$CONTAINER" node scripts/db-backup.mjs "/data/$TMP_NAME"

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
find "$BACKUP_ROOT" -type f \( -name 'wishlist-*.json' -o -name 'wishlist-*.json.enc' \
  -o -name 'wishlist-*.db' -o -name 'wishlist-*.db.enc' \) -mtime +"$KEEP" -delete

echo "keep=${KEEP}d — $(find "$BACKUP_ROOT" -type f | wc -l) file(s)"
