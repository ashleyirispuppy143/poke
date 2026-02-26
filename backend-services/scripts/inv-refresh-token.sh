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

scriptDir=$(dirname "$(readlink -f "$0")")

output=$(docker run quay.io/invidious/youtube-trusted-session-generator)

visitor_data=$(echo "$output" | grep -oP '(?<=visitor_data: )[^ ]+')
po_token=$(echo "$output" | grep -oP '(?<=po_token: )[^ ]+')

if [ -z "$visitor_data" ] || [ -z "$po_token" ]; then
  echo "Error: Could not generate visitor_data or po_token."
  exit 1
fi

sed -i "s/visitor_data: .*/visitor_data: $visitor_data/g" $scriptDir/../services/invidious/docker-compose.yml
sed -i "s/po_token: .*/po_token: $po_token/g" $scriptDir/../services/invidious/docker-compose.yml

cd $scriptDir/../services/invidious

 docker compose up -d

echo "Successfully updated visitor_data and po_token on Invidious."

