#!/usr/bin/env bash
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

function display_help {
    echo "Usage: $0 <search_query>"
    echo "  --help       you are here lol"
    echo "  --version    version information."
    echo "  --license    license stuff"
}

function display_version {
echo "poke-cli version 1.2

Play videos from your terminal!
https://codeberg.org/ashleyirispuppy/poke

Copyright (C) 2024-202x Poke
License GPLv3+: GNU GPL version 3 or later <https://gnu.org/licenses/gpl.html>.
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.
"
}

# Display license information
function display_license {
    cat <<EOF

    Poke-CLI for GNU/Linux systems

    Copyright (C) Poke 2024-20xx

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

EOF
}

case $1 in
    --help)
        display_help
        exit 0
        ;;
    --version)
        display_version
        exit 0
        ;;
    --license)
        display_license
        exit 0
        ;;
esac

if [ $# -eq 0 ]; then
    echo "Usage: $0 <search_query> / see --help for more info :D"
    exit 1
fi

# config
poke_instance="https://poketube.fun"
invid_api_url="https://invid-api.poketube.fun"

search_query=$1

player="mpv"


if ! command -v jq &> /dev/null && ! command -v gojq &> /dev/null; then
    echo "Error: jq or gojq not found. Please install them to run the script."
    exit 1
fi

json_data=$(curl -s "$invid_api_url/api/v1/search?q=${search_query// /+}&type=video")

video_count=$(echo "$json_data" | jq -r '. | length')
if [ $video_count -eq 0 ]; then
    echo "Nyo videos found for the given search query ;_;"
    exit 1
fi

echo "Select a vid to play:"
echo

for i in $(seq 0 $(($video_count - 1))); do
    title=$(echo "$json_data" | jq -r ".[$i].title")
    author=$(echo "$json_data" | jq -r ".[$i].author")
    echo "[$(($i + 1))] $title by $author"
done

read -p "Enter the thingy umm number of the video to play (1-$video_count): " selection

if ! [[ "$selection" =~ ^[1-9][0-9]*$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt "$video_count" ]; then
    echo "enter a number between 1 and $video_count lol"
    exit 1
fi

video_url=$(echo "$json_data" | jq -r ".[$(($selection - 1))].videoId")

echo "Starting $player..."
echo "please wait - this may take some time lol..."

$player "$poke_instance/watch?v=$video_url"

