#!/usr/bin/env bash
# Permissions owner-only sur env + volume data Oh, You Shouldn't!.
set -euo pipefail

ENV_FILE="${WHISHLIST_ENV_FILE:-$HOME/webserver/data/whishlist.env}"
DATA_DIR="${WHISHLIST_DATA_DIR:-$HOME/webserver/data/whishlist}"

mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"
chmod 600 "$ENV_FILE" 2>/dev/null || true

# Base SQLite et ses fichiers annexes, ancien JSON (gardé tel quel après l'import)
for f in wishlist.db wishlist.db-wal wishlist.db-shm wishlist.json; do
  [[ -f "$DATA_DIR/$f" ]] && chmod 600 "$DATA_DIR/$f"
done

# Logs optionnels
for f in mail.log password-reset.log; do
  [[ -f "$DATA_DIR/$f" ]] && chmod 600 "$DATA_DIR/$f"
done

# Conteneur : même owner que compose (uid 1000)
if id -u 1000 >/dev/null 2>&1; then
  chown -R 1000:1000 "$DATA_DIR" 2>/dev/null || true
fi

echo "hardened: $DATA_DIR + $ENV_FILE"
ls -la "$ENV_FILE" "$DATA_DIR"
