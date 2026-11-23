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

if [[ "${1:-}" == "--cron" ]]; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$CHECK_URL" || true)
    if [[ "$STATUS" == "200" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $CHECK_URL returned 200. Skipping swap."
        exit 0
    fi
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $CHECK_URL returned $STATUS. Swapping..."
fi

for f in "$ACTIVE" "${INACTIVE[@]}"; do
    if [[ ! -f "$f" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Error: Missing file ($f)." >&2
        exit 1
    fi
done

# Randomly pick one of the inactive configs
PICK="${INACTIVE[RANDOM % ${#INACTIVE[@]}]}"

mv "$ACTIVE" "$TEMP_FILE"
mv "$PICK" "$ACTIVE"
mv "$TEMP_FILE" "$PICK"

# Restart the containers (adjust..... if you use a different compose file)
docker compose down companion gluetun
docker compose up -d gluetun companion

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Swapped $ACTIVE with $PICK and restarted gluetun and companion."

# Example cron entry to run every 30 minutes (we do this on our server!):
# */30 * * * * /path/to/this_script.sh --cron