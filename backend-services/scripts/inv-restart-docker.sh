#!/bin/bash

#
#    Copyright (C) 2024-20xx Poke! (https://codeberg.org/ashleyirispuppy/poke)
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#

# Function to generate a random Chrome version
generate_random_chrome_version() {
    major=$((RANDOM % 100 + 1))    # Major version 1-99
    minor=$((RANDOM % 100))        # Minor version 0-99
    build=$((RANDOM % 10000))      # Build version 0-9999
    patch=$((RANDOM % 100))        # Patch version 0-99
    echo "$major.$minor.$build.$patch"
}

restart_services() {
    echo "Restarting services..."

    # Navigate to the script directory
    scriptDir=$(dirname "$(readlink -f "$0")")

    cd "$scriptDir/../services/invidious" || { echo "Error: Failed to navigate to $scriptDir/../services/invidious"; exit 1; }

    docker compose down
    echo "Services stopped. Restarting..."

    docker compose up -d
    echo "Services restarted successfully."

    /home/qt/globe/scripts/inv-update-token.sh
}

fetch_playlist() {
    local playlist_id="$1"
    response=$(curl -s -w "%{http_code}" -o /tmp/playlist_data.json "https://invid-api.poketube.fun/api/v1/playlists/${playlist_id}")

    if [ "$response" -eq 502 ] || [ "$response" -eq 500 ] || [ "$response" -eq 403 ]; then
        echo "Error: Failed to fetch playlist data. HTTP Status: $response"
        restart_services
        return 1
    elif [ "$response" -ne 200 ]; then
        echo "Error: Failed to fetch playlist data. HTTP Status: $response"
        return 1
    fi
}

extract_video_ids() {
    local json_data="$1"
    video_ids=$(jq -r '.videos[].videoId' "$json_data")
    if [ -z "$video_ids" ]; then
        echo "Error: Failed to extract video IDs from the playlist data."
        return 1
    fi
    echo "$video_ids"
}

# Playlist IDs to fetch
playlist_ids=("PLMws9SCqJ1JCeVMVPsdamuUM0HK0MbA6g")

# Base URL for the API
base_url="http://localhost:54301/latest_version?id="

# Pick a random playlist (without using invalid options in shuf)
random_playlist_id="PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl"
echo "Randomly selected playlist: $random_playlist_id"

# Fetch playlist JSON data
fetch_playlist "$random_playlist_id"
if [ $? -ne 0 ]; then
    echo "Error: Playlist fetch failed. Restarting services..."
    restart_services  # Restart services before exiting
    exit 1
fi

# Extract video IDs from the playlist
video_ids=($(extract_video_ids "/tmp/playlist_data.json"))
if [ $? -ne 0 ]; then
    echo "Error: Failed to extract video IDs. Exiting..."
    exit 1
fi

# Shuffle video IDs and pick 4 random videos
shuffled_video_ids=($(shuf -e "${video_ids[@]}" | head -n 4))

error_count=0  
all_errors=(500 502 403)  

for video_id in "${shuffled_video_ids[@]}"; do
    # Add a cache buster query (unique random number)
    unique_param=$RANDOM
    url="${base_url}${video_id}&itag=18&local=true&_=${unique_param}"

    # Generate a random Chrome version
    chrome_version=$(generate_random_chrome_version)

    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/$chrome_version Safari/537.36"

    response_headers=$(curl -s -D - -H "Cache-Control: no-cache, no-store, must-revalidate" \
        -H "Pragma: no-cache" -H "Expires: 0" -A "$user_agent" "$url" -o /dev/null)

    # Extract ETag and last modified info (if available)
    etag=$(echo "$response_headers" | grep -i ETag | awk '{print $2}' | tr -d '"')
    last_modified=$(echo "$response_headers" | grep -i Last-Modified | cut -d' ' -f2-)

    # Use conditional request if ETag is present
    if [ -n "$etag" ]; then
        status_code=$(curl -s -o /dev/null -w "%{http_code}" -H "If-None-Match: $etag" \
            -H "Cache-Control: no-cache, no-store, must-revalidate" -A "$user_agent" "$url")
    else
        status_code=$(curl -s -o /dev/null -w "%{http_code}" -A "$user_agent" "$url")
    fi

    # Echo the status code for visibility
    echo "Checking URL: $url" 
    echo "User Agent: $user_agent"
    echo "HTTP Status Code for ID $video_id: $status_code"

    if [[ " ${all_errors[@]} " =~ " ${status_code} " ]]; then
        echo "Error: Received $status_code for ID $video_id."
        error_count=$((error_count + 1))
        
        # Run the token refresh script
        echo "Running inv-update-token.sh for ID $video_id..."
        /home/qt/globe/scripts/inv-update-token.sh
        /home/qt/globe/scripts/inv-update-token.sh
        echo "inv-update-token.sh script executed successfully."

        # Fetch the video again after token refresh
        status_code=$(curl -s -o /dev/null -w "%{http_code}" -A "$user_agent" "$url")
        echo "Post-token-refresh Status Code for ID $video_id: $status_code"
        
        # Check if it still results in 500/502/403 after refresh
        if [[ " ${all_errors[@]} " =~ " ${status_code} " ]]; then
            echo "Error: Received $status_code for ID $video_id after token refresh."
        else
            echo "Token refresh succeeded for ID $video_id."
        fi
    elif [ "$status_code" -eq 304 ]; then
        echo "Content is still fresh for ID $video_id. No action required."
    else
        echo "we are so barack (Status code for ID $video_id is neither 502, 500, nor 403.)"
    fi

    echo "----------------****************----------------"  # Separator for readability
done

# If all videos still resulted in 500/502/403 errors even after running inv-update-token.sh, try restaring 
if [ "$error_count" -eq "${#shuffled_video_ids[@]}" ]; then
    echo "All videos failed to load after running inv-update-token.sh. Restarting services..."
    restart_services
fi
