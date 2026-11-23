#!/usr/bin/env bash
# This code is under public domain

set -euo pipefail

cd "$(dirname "$0")"

# Replace the placeholder with the URL you want to check! (e.g <my-ip>/watch?v=videoid)
CHECK_URL="PLACEHOLDER"
ACTIVE="./wireguard.conf"
# Add as many WireGuard config files as you need :3 they should each correspond to a distinct exit IP !
INACTIVE=("./wireguardconf-1" "./wireguardconf-2" "./wireguardconf-3")
TEMP_FILE="./.wireguard_swap.tmp"
WAIT_FOR_TOKEN=35
MAX_RETRIES=3

exec 200>/tmp/wireguard_swap.lock
flock -n 200 || { echo "[$(date '+%Y-%m-%d %H:%M:%S')] Swap already running. Exiting."; exit 0; }

check_health() {
    curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$CHECK_URL" || echo "000"
}

if [[ "${1:-}" == "--cron" ]]; then
    STATUS=$(check_health)
    if [[ "$STATUS" == "200" ]]; then
        exit 0
    fi
    sleep 5
    STATUS=$(check_health)
    if [[ "$STATUS" == "200" ]]; then
        exit 0
    fi
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check failed twice ($STATUS). Starting self-heal..."
fi

for f in "$ACTIVE" "${INACTIVE[@]}"; do
    if [[ ! -f "$f" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Error: Missing file ($f)." >&2
        exit 1
    fi
done

for ((i=1; i<=MAX_RETRIES; i++)); do
    PICK="${INACTIVE[RANDOM % ${#INACTIVE[@]}]}"

    mv "$ACTIVE" "$TEMP_FILE"
    mv "$PICK" "$ACTIVE"
    mv "$TEMP_FILE" "$PICK"

   # Restart the containers (adjust..... if you use a different compose file) 
    docker compose down companion gluetun
    docker compose up -d gluetun companion

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Attempt $i/$MAX_RETRIES: Swapped to $PICK. Waiting ${WAIT_FOR_TOKEN}s for po_token..."
    sleep "$WAIT_FOR_TOKEN"

    STATUS=$(check_health)
    if [[ "$STATUS" == "200" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Success! $CHECK_URL returned 200."
        exit 0
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Attempt $i/$MAX_RETRIES still returned $STATUS."
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed to recover after $MAX_RETRIES attempts." >&2
exit 1

# Example cron entry to run every 30 minutes (we do this on our server!): 
# */30 * * * * /path/to/this_script.sh --cron