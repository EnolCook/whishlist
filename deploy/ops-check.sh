#!/usr/bin/env bash
# Smoke / hygiène ops Oh, You Shouldn't! sur le Mac mini.
set -euo pipefail

DOMAIN="${WHISHLIST_DOMAIN:-ohyoushouldnt.app}"
PORT="${WHISHLIST_PORT:-8740}"
ENV_FILE="${WHISHLIST_ENV_FILE:-$HOME/webserver/data/whishlist.env}"
DATA_DIR="${WHISHLIST_DATA_DIR:-$HOME/webserver/data/whishlist}"
fail=0

ok() { echo "OK  $*"; }
ko() { echo "FAIL $*"; fail=1; }

echo "-- container"
if docker ps --filter name=whishlist --format '{{.Status}}' | grep -qi healthy; then
  ok "whishlist healthy"
else
  ko "whishlist not healthy: $(docker ps -a --filter name=whishlist --format '{{.Status}}')"
fi

echo "-- http"
code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN}" "http://127.0.0.1:${PORT}/" || true)
[[ "$code" == "200" ]] && ok "local $code" || ko "local $code"
pcode=$(curl -sS -o /dev/null -w '%{http_code}' "https://${DOMAIN}/" || true)
[[ "$pcode" == "200" ]] && ok "public $pcode" || ko "public $pcode"

echo "-- env"
[[ -f "$ENV_FILE" ]] || ko "missing $ENV_FILE"
perm=$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%OLp' "$ENV_FILE")
[[ "$perm" == "600" ]] && ok "env mode $perm" || ko "env mode $perm (want 600)"

need=(WHISHLIST_SESSION_SECRET WHISHLIST_APP_ORIGIN)
for k in "${need[@]}"; do
  if grep -q "^${k}=" "$ENV_FILE" && ! grep -q "^${k}=$" "$ENV_FILE"; then
    ok "$k set"
  else
    ko "$k missing/empty in env file"
  fi
done

if grep -q '^WHISHLIST_RESEND_API_KEY=.\+' "$ENV_FILE" && grep -q '^WHISHLIST_MAIL_FROM=.\+' "$ENV_FILE"; then
  ok "Resend configured in env file"
else
  ko "Resend incomplete (reset/invite mails won't send)"
fi

echo "-- container env"
for k in APP_ORIGIN SESSION_SECRET NODE_ENV; do
  v=$(docker exec whishlist printenv "$k" 2>/dev/null || true)
  if [[ -n "$v" ]]; then ok "container $k set"; else ko "container $k empty"; fi
done
resend=$(docker exec whishlist printenv RESEND_API_KEY 2>/dev/null || true)
[[ -n "$resend" ]] && ok "container RESEND_API_KEY set" || ko "container RESEND_API_KEY empty"

echo "-- data"
[[ -f "$DATA_DIR/wishlist.db" ]] || ko "missing wishlist.db"
dperm=$(stat -c '%a' "$DATA_DIR" 2>/dev/null || stat -f '%OLp' "$DATA_DIR")
[[ "$dperm" == "700" ]] && ok "data dir $dperm" || ko "data dir $dperm (want 700)"
for f in wishlist.db wishlist.db-wal wishlist.db-shm; do
  [[ -f "$DATA_DIR/$f" ]] || continue
  fperm=$(stat -c '%a' "$DATA_DIR/$f" 2>/dev/null || stat -f '%OLp' "$DATA_DIR/$f")
  [[ "$fperm" == "600" ]] && ok "$f $fperm" || ko "$f $fperm (want 600)"
done

echo "-- backups"
BACKUP_ROOT="${WHISHLIST_BACKUP_DIR:-$HOME/webserver/backups/whishlist}"
if [[ -d "$BACKUP_ROOT" ]] && find "$BACKUP_ROOT" -type f -name 'wishlist-*' -mtime -2 | grep -q .; then
  ok "recent backup present"
else
  ko "no backup <48h in $BACKUP_ROOT (run deploy/backup-whishlist.sh + cron)"
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "ALL CHECKS PASSED"
  exit 0
fi
echo "SOME CHECKS FAILED"
exit 1
