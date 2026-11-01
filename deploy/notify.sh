#!/usr/bin/env bash
# Notification ntfy des scripts d'exploitation Oh, You Shouldn't! : notify.sh <titre> <message> [priorité]
# Optionnelle : sans WHISHLIST_NTFY_TOPIC, ne fait rien. Un échec d'envoi ne fait jamais échouer l'appelant.
# Titre et options passés en paramètres d'URL (UTF-8 sûr, contrairement aux en-têtes HTTP).
set -uo pipefail

TOPIC="${WHISHLIST_NTFY_TOPIC:-}"
[[ -n "$TOPIC" ]] || exit 0
URL="${WHISHLIST_NTFY_URL:-http://127.0.0.1:8166}"
TOKEN_FILE="${WHISHLIST_NTFY_TOKEN_FILE:-$HOME/webserver/data/whishlist.ntfy-token}"

auth=()
if [[ -r "$TOKEN_FILE" ]]; then
  auth=(-H "Authorization: Bearer $(<"$TOKEN_FILE")")
fi

curl -fsS --max-time 10 ${auth[@]+"${auth[@]}"} \
  --url-query "title=🎁 ${1:-whishlist}" \
  --url-query "priority=${3:-default}" \
  --data-binary "${2:-}" \
  "$URL/$TOPIC" >/dev/null || echo "ntfy: notification non envoyée ($URL/$TOPIC)" >&2
exit 0
