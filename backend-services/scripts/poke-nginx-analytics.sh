#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# poke-nginx-analytics — IPv4/IPv6 traffic analyzer for Nginx access logs.
# Author: Ashley Iris — https://ashleyirispup.cat
# Copyright (C) 2025 Poke Initiative
#
# This is free software: you can redistribute it and/or modify it
# under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

set -euo pipefail

# --------------------------- Metadata ---------------------------

VERSION="1.3.0"
SCRIPT_NAME="poke-nginx-analytics.sh"

# DISCLAIMER:
# This tool reads your existing local Nginx access logs and prints
# aggregate counts to your terminal. It makes no network requests,
# stores nothing, and sends nothing anywhere. 
 
# --------------------------- Defaults ---------------------------

LOG_GLOB="/var/log/nginx/access.log*"
DATEPAT="$(date +"%d/%b/%Y")"           # e.g. "02/Oct/2025"
SINCE=""                                 # "HH:MM" within DATEPAT (inclusive)
UNTIL=""                                 # "HH:MM" within DATEPAT (inclusive)
WATCH_INTERVAL=""                        # seconds; if set, loop output

SUCCESS_CODES_DEFAULT="200,301,302,304"
SUCCESS_REGEX_DEFAULT=""

IGNORE_BOTS_DEFAULT="0"
BOT_REGEX_DEFAULT='(?i)(bot|spider|crawler|bingpreview|httpclient|curl|wget|headless|phantom|scrapy|uptimerobot|validator|pingdom|ahrefs|semrush|mj12|yandex|baiduspider|facebookexternalhit|discordbot)'

TOP_LIMIT_DEFAULT=10
ANONIP_DEFAULT="0"                       # mask IPs in uniques/top lists (v4 /24; v6 /64)

SHOW_LOADING_DEFAULT="1"                 # show “Loading …” spinner for longer actions

# --------------------------- License / Privacy ------------------

print_license() {
  cat <<'LIC'
poke-nginx-analytics — IPv4/IPv6 traffic analyzer for Nginx access logs.
Author: Ashley Iris — https://ashleyirispup.cat
Copyright (C) 2025 Poke Initiative

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
this program. If not, see: https://www.gnu.org/licenses/gpl-3.0.html
LIC
}

print_privacy() {
  cat <<'PV'
The Software operates locally on the controller’s host and processes only the HTTP access log files specified by the controller (by default, /var/log/nginx/access.log*). Processing is limited to parsing log lines to compute ephemeral aggregate statistics such as counts by IP version, status code, and hour; no identification, profiling, cross-service correlation, or tracking is performed. The Software initiates no outbound network connections and transmits no telemetry or data to third parties. Output is directed solely to the invoking terminal session and is not persisted unless the controller elects to do so (for example, by redirecting standard output). The controller remains solely responsible for the lawfulness of logging and retention; the Software does not modify logging configuration or retention policies and does not create additional stores. Optional controls permit the controller to pseudonymize displayed addresses (masking IPv4 to /24 and IPv6 to /64) and to exclude typical automated User-Agents; these controls affect only presentation and do not alter source logs. Use of the Software constitutes processing under the controller’s legitimate administrative interests in operating, securing, and troubleshooting services. The Software performs deterministic, documented parsing of provided files and is publicly licensed under GPL-3.0-or-later, enabling independent audit. No special privileges are required beyond read access to the designated log files.
PV
}

# --------------------------- Usage ------------------------------

usage() {
  cat <<USAGE
$SCRIPT_NAME v$VERSION — IPv4/IPv6 traffic analyzer for Nginx access logs
Author: Ashley Iris — https://ashley0143.xyz

Usage:
  $SCRIPT_NAME <subcommand> [options]

Subcommands:
  today                     Show today's IPv4 and IPv6 counts and percentages (optionally time-windowed).
  today-success             Same as above but success-only.
  today-fail                Same as above but fail-only (non-success).
  success-rate              Show success rate today for v4/v6, plus totals and top 5 fail codes.
  v4-today                  IPv4 count today.
  v6-today                  IPv6 count today.
  v4-today-success          IPv4 success-only today.
  v6-today-success          IPv6 success-only today.
  breakdown-today v4|v6     Status-code breakdown today for v4 or v6.
  hourly                    Hourly breakdown today for v4/v6 (+totals).
  uniques                   Unique IP counts today for v4 and v6 (respects --anonip).
  top-ips v4|v6             Top client IPs today for the chosen family (respects --anonip).
  top-fails                 Top 5 failure reasons today (codes + short explanations and common fixes).
  all                       IPv4 vs IPv6 totals from all logs (no date/time filter).

Options:
  --file PATH|GLOB          Single log path or glob (default: /var/log/nginx/access.log*)
  --date DD/Mon/YYYY        Override date filter (default: today)
  --since HH:MM             Start time within --date (inclusive)
  --until HH:MM             End time within --date (inclusive)
  --success-codes "list"    Comma-separated list (default: 200,301,302,304)
  --success-regex REGEX     Regex for success, e.g. '^(2..|3..)$' (overrides codes list)
  --ignore-bots             Exclude bots by UA regex (see --bot-regex)
  --bot-regex REGEX         Override bot UA regex (default is broad and case-insensitive)
  --limit N                 Limit for top-ips (default: 10)
  --anonip                  Mask IPs in uniques/top-ips (v4 /24; v6 /64)
  --watch SECONDS           Refresh output every N seconds
  --no-loading              Disable the spinner/“Loading …” message
  --license | -license      Print GPL-3.0-or-later license notice
  --privacy                 Print a privacy statement
  --version                 Print version and exit
  -h, --help                Show this help

Notes:
- Handles rotated + gz logs automatically (access.log, access.log.1, access.log.2.gz, ...).
- Time filters apply inside the chosen --date only.
- If both --success-regex and --success-codes are set, regex wins.
USAGE
}

# --------------------------- Helpers ---------------------------

LOG_FILES=()
SUCCESS_CODES="$SUCCESS_CODES_DEFAULT"
SUCCESS_REGEX="$SUCCESS_REGEX_DEFAULT"
TOP_LIMIT="$TOP_LIMIT_DEFAULT"
IGNORE_BOTS="$IGNORE_BOTS_DEFAULT"
BOT_REGEX="$BOT_REGEX_DEFAULT"
ANONIP="$ANONIP_DEFAULT"
SHOW_LOADING="$SHOW_LOADING_DEFAULT"

SUB=""
FAMILY=""  # v4 or v6

expand_logs() {
  local glob="${1:-$LOG_GLOB}"
  # shellcheck disable=SC2206
  local arr=($glob)
  LOG_FILES=()
  for f in "${arr[@]}"; do
    if ([[ -f "$f" ]] || [[ "$f" =~ \* ]]); then LOG_FILES+=("$f"); fi
  done
  if [[ ${#LOG_FILES[@]} -eq 1 && "${LOG_FILES[0]}" == *"*"* ]]; then
    # shellcheck disable=SC2206
    local rexpanded=(${LOG_FILES[0]})
    LOG_FILES=()
    for f in "${rexpanded[@]}"; do
      if [[ -f "$f" ]]; then LOG_FILES+=("$f"); fi
    done
  fi
  if [[ ${#LOG_FILES[@]} -eq 0 ]]; then
    echo "No log files found for: $glob" >&2
    exit 1
  fi
}

read_logs() {
  for f in "${LOG_FILES[@]}"; do
    case "$f" in
      *.gz) zcat -f -- "$f" ;;
      *)     cat -- "$f" ;;
    esac
  done
}

percent() {
  local part="$1" total="$2"
  if [[ "$total" -eq 0 ]]; then printf "0.0"; return; fi
  awk -v p="$part" -v t="$total" 'BEGIN{ printf("%.1f", (p*100.0)/t) }'
}

awk_date_guard() {
  if [[ -z "$SINCE$UNTIL" ]]; then
    echo 'substr($4,2,11)==datepat'
  else
    local cond='substr($4,2,11)==datepat'
    if [[ -n "$SINCE" ]]; then
      cond="$cond && substr(\$4,14,5)>=since"
    fi
    if [[ -n "$UNTIL" ]]; then
      cond="$cond && substr(\$4,14,5)<=until"
    fi
    echo "$cond"
  fi
}

awk_common_header() {
  cat <<'AWKHEAD'
function is_ipv4(ip) { return ip ~ /^([0-9]{1,3}\.){3}[0-9]{1,3}$/ }
function is_ipv6(ip) { return ip ~ /:/ && !(ip ~ /^([0-9]{1,3}\.){3}[0-9]{1,3}$/) }

# Get the last quoted field as UA (combined log format)
function extract_ua(line,   ua) {
  if (match(line, /"[^"]*"$/)) {
    ua = substr(line, RSTART+1, RLENGTH-2);
    return ua;
  }
  return "";
}

# Mask IPv4 to /24, IPv6 to /64 (display only)
function anon_ip(ip,   a, i, out, n) {
  if (anonip==0) return ip;
  if (is_ipv4(ip)) {
    n = split(ip, a, ".");
    if (n==4) { a[4]=0; return a[1]"."a[2]"."a[3]".0" }
    return ip;
  } else if (is_ipv6(ip)) {
    n = split(ip, a, ":");
    for (i=5; i<=n; i++) a[i]="0000";
    out=a[1];
    for (i=2;i<=n;i++) out=out ":" a[i];
    return out;
  }
  return ip;
}

function ok_status(code) {           # success by regex or by list
  if (has_regex) return (code ~ success_regex);
  return (code in okcodes);
}
AWKHEAD
}

awk_begin_block() {
  local bot_awk_regex
  bot_awk_regex=$(printf '%s' "$BOT_REGEX" | sed 's/[&/\]/\\&/g')
  cat <<EOF
BEGIN {
  has_regex = ("$SUCCESS_REGEX" != "");
  success_regex = "$SUCCESS_REGEX";
  if (!has_regex) {
    split("$SUCCESS_CODES", arr, ",");
    for (i in arr) okcodes[arr[i]]=1;
  }
  ignore_bots = $IGNORE_BOTS;
  bot_regex = "$bot_awk_regex";
  anonip = $ANONIP;
}
EOF
}

count_family_today() {
  local fam="$1" mode="$2"
  local date_guard; date_guard="$(awk_date_guard)"
  local pred_ip
  if [[ "$fam" == "v4" ]]; then pred_ip='is_ipv4($1)'
  else pred_ip='is_ipv6($1)'
  fi

  awk -v datepat="$DATEPAT" -v since="$SINCE" -v until="$UNTIL" '
'"$(awk_common_header)"'
'"$(awk_begin_block)"'
{
  if (!('"$date_guard"')) next;

  if (ignore_bots) {
    ua = extract_ua($0);
    if (ua ~ bot_regex) next;
  }

  if (!('"$pred_ip"')) next;

  status = $9;
  success = ok_status(status);

  if ("'"$mode"'"=="any") c++;
  else if ("'"$mode"'"=="success" && success) c++;
  else if ("'"$mode"'"=="fail" && !success) c++;
}
END { print c+0 }
' < <(read_logs)
}

status_breakdown_today() {
  local fam="$1"
  local date_guard; date_guard="$(awk_date_guard)"
  local pred_ip
  if [[ "$fam" == "v4" ]]; then pred_ip='is_ipv4($1)'
  else pred_ip='is_ipv6($1)'
  fi

  awk -v datepat="$DATEPAT" -v since="$SINCE" -v until="$UNTIL" '
'"$(awk_common_header)"'
'"$(awk_begin_block)"'
{
  if (!('"$date_guard"')) next;

  if (ignore_bots) {
    ua = extract_ua($0);
    if (ua ~ bot_regex) next;
  }

  if (!('"$pred_ip"')) next;

  code=$9; count[code]++;
}
END {
  for (c in count) printf "%10d  %s\n", count[c], c | "sort -nr";
  close("sort -nr");
}
' < <(read_logs)
}

hourly_breakdown_today() {
  local date_guard; date_guard="$(awk_date_guard)"

  awk -v datepat="$DATEPAT" -v since="$SINCE" -v until="$UNTIL" '
'"$(awk_common_header)"'
'"$(awk_begin_block)"'
{
  if (!('"$date_guard"')) next;

  if (ignore_bots) {
    ua = extract_ua($0);
    if (ua ~ bot_regex) next;
  }

  hh=substr($4,14,2);
  if (is_ipv4($1)) v4[hh]++; else if (is_ipv6($1)) v6[hh]++;
}
END {
  printf "Hour  |   v4     v6     total\n";
  printf "------+------------------------\n";
  for (i=0; i<24; i++) {
    h = sprintf("%02d", i);
    a=v4[h]+0; b=v6[h]+0; t=a+b;
    printf "%s    | %6d %6d %8d\n", h, a, b, t;
  }
}
' < <(read_logs)
}

unique_ips_today() {
  local date_guard; date_guard="$(awk_date_guard)"

  awk -v datepat="$DATEPAT" -v since="$SINCE" -v until="$UNTIL" '
'"$(awk_common_header)"'
'"$(awk_begin_block)"'
{
  if (!('"$date_guard"')) next;

  if (ignore_bots) {
    ua = extract_ua($0);
    if (ua ~ bot_regex) next;
  }

  ip=$1;
  aip=anon_ip(ip);

  if (is_ipv4(ip)) v4[aip]=1;
  else if (is_ipv6(ip)) v6[aip]=1;
}
END {
  print (length(v4)+0) " " (length(v6)+0);
}
' < <(read_logs)
}

top_ips_today() {
  local fam="$1" limit="$2"
  local date_guard; date_guard="$(awk_date_guard)"
  local pred_ip
  if [[ "$fam" == "v4" ]]; then pred_ip='is_ipv4($1)'
  else pred_ip='is_ipv6($1)'
  fi

  awk -v datepat="$DATEPAT" -v since="$SINCE" -v until="$UNTIL" -v lim="$limit" '
'"$(awk_common_header)"'
'"$(awk_begin_block)"'
{
  if (!('"$date_guard"')) next;

  if (ignore_bots) {
    ua = extract_ua($0);
    if (ua ~ bot_regex) next;
  }

  if (!('"$pred_ip"')) next;

  ip=$1;
  aip=anon_ip(ip);
  c[aip]++;
}
END {
  cmd = "sort -nr | head -n " lim;
  for (k in c) printf "%10d  %s\n", c[k], k | cmd;
  close(cmd);
}
' < <(read_logs)
}

# collect top failure codes (v4+v6 combined)
_top_fail_codes_today_raw() {
  local limit="${1:-5}"
  local date_guard; date_guard="$(awk_date_guard)"
  awk -v datepat="$DATEPAT" -v since="$SINCE" -v until="$UNTIL" -v lim="$limit" '
'"$(awk_common_header)"'
'"$(awk_begin_block)"'
{
  if (!('"$date_guard"')) next;

  if (ignore_bots) {
    ua = extract_ua($0);
    if (ua ~ bot_regex) next;
  }

  code=$9;
  if (!ok_status(code)) fails[code]++;
}
END {
  cmd = "sort -nr | head -n " lim;
  for (c in fails) printf "%10d %s\n", fails[c], c | cmd;
  close(cmd);
}
' < <(read_logs)
}

# map codes to short reason + common fixes
_code_reason_and_fix() {
  local code="$1"
  case "$code" in
    404) echo "Not Found | Check routes/file paths; verify upstream/location blocks; add/refresh indexes." ;;
    403) echo "Forbidden | Fix permissions/SELinux; review 'deny' rules; ensure correct root/user; auth config." ;;
    400) echo "Bad Request | Validate request size/headers; client encoding; large header buffers." ;;
    401) echo "Unauthorized | Confirm auth headers/keys; verify Basic/Bearer configs; clock skew for signed URLs." ;;
    408) echo "Client Timeout | Client slow; increase client_header/body_timeout; check network; throttle long uploads." ;;
    413) echo "Payload Too Large | Raise client_max_body_size; review upload size from client/app." ;;
    414) echo "URI Too Long | Reduce query size; switch to POST; adjust large_client_header_buffers." ;;
    429) echo "Too Many Requests | Tuning rate limiting/burst; whitelist health checks/bots if intended." ;;
    499) echo "Client Closed Request | Client aborted/timeout; investigate latency; optimize upstream; keepalive." ;;
    500) echo "Internal Server Error | Check app errors; upstream logs; fastcgi/proxy params; temp file perms." ;;
    502) echo "Bad Gateway | Upstream down/misconfigured; check upstream server, sockets, DNS, healthchecks." ;;
    503) echo "Service Unavailable | Upstream overloaded/maintenance; tune workers; queue/backoff; autoscale." ;;
    504) echo "Gateway Timeout | Upstream slow; raise proxy_read_timeout; profile app/DB; connection pool." ;;
    530|531|532) echo "Upstream/Custom Error | Vendor or custom code; check error_page mapping and upstream." ;;
    301|302|304) echo "Redirect/Not Modified | Typically not a failure; ensure correct cache/redirect rules." ;;
    *)   # generic 4xx/5xx buckets
         case "$code" in
           4??) echo "Client Error | Validate client requests, auth, size limits, and security rules." ;;
           5??) echo "Server Error | Inspect upstream/app, timeouts, resource limits, and Nginx proxy config." ;;
           *)   echo "Other | Review Nginx error logs and upstream/application logs." ;;
         esac ;;
  esac
}

# pretty top fails with reasons and fixes
top_fail_reasons_today() {
  local limit="${1:-5}"
  _top_fail_codes_today_raw "$limit" | while read -r cnt code; do
    local info; info=$(_code_reason_and_fix "$code")
    local reason=${info%|*}
    local fix=${info#*|}
    printf "%10d  %s  — %s\n           fix: %s\n" "$cnt" "$code" "$(echo "$reason" | sed 's/^ *//')" "$(echo "$fix" | sed 's/^ *//')"
  done
}

count_all_family() {
  local fam="$1"
  local pred_ip
  if [[ "$fam" == "v4" ]]; then pred_ip='is_ipv4($1)'
  else pred_ip='is_ipv6($1)'
  fi

  awk '
'"$(awk_common_header)"'
BEGIN { ignore_bots=0; has_regex=0; anonip=0; }
{
  if (!('"$pred_ip"')) next;
  c++;
}
END { print c+0 }
' < <(read_logs)
}

# ----------------------- Spinner / Loading ---------------------

_spinner_start() {
  [[ "$SHOW_LOADING" != "1" || -n "${WATCH_INTERVAL}" ]] && return 0
  local msg="${1:-Loading…}"
  printf "%s " "$msg"
  (
    i=0
    while :; do
      case $((i%4)) in
        0) c='|';;
        1) c='/';;
        2) c='-';;
        3) c='\\';;
      esac
      printf "\r%s %s" "$msg" "$c"
      i=$((i+1))
      sleep 0.15
    done
  ) &
  SPINNER_PID=$!
  disown "$SPINNER_PID" 2>/dev/null || true
}

_spinner_stop() {
  [[ "${SPINNER_PID:-}" =~ ^[0-9]+$ ]] || return 0
  kill "$SPINNER_PID" 2>/dev/null || true
  wait "$SPINNER_PID" 2>/dev/null || true
  unset SPINNER_PID
  printf "\r\033[K"
}

run_with_spinner() {
  local msg="$1"; shift
  local tmp; tmp="$(mktemp)"
  _spinner_start "$msg"
  (
    "$@"
  ) >"$tmp" 2>&1 || true
  _spinner_stop
  cat "$tmp"
  rm -f "$tmp"
}

# -------------------------- CLI Parse --------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --license|-license) print_license; exit 0 ;;
    --privacy)          print_privacy; exit 0 ;;
    --version)          echo "$SCRIPT_NAME v$VERSION"; exit 0 ;;
    today|today-success|today-fail|success-rate|v4-today|v6-today|v4-today-success|v6-today-success|breakdown-today|hourly|uniques|top-ips|top-fails|all)
      SUB="$1"; shift ;;
    v4|v6) FAMILY="$1"; shift ;;
    --file) LOG_GLOB="$2"; shift 2 ;;
    --date) DATEPAT="$2"; shift 2 ;;
    --since) SINCE="$2"; shift 2 ;;
    --until) UNTIL="$2"; shift 2 ;;
    --success-codes) SUCCESS_CODES="$2"; shift 2 ;;
    --success-regex) SUCCESS_REGEX="$2"; shift 2 ;;
    --ignore-bots) IGNORE_BOTS="1"; shift ;;
    --bot-regex) BOT_REGEX="$2"; shift 2 ;;
    --limit) TOP_LIMIT="$2"; shift 2 ;;
    --anonip) ANONIP="1"; shift ;;
    --watch) WATCH_INTERVAL="$2"; shift 2 ;;
    --no-loading) SHOW_LOADING="0"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

expand_logs "$LOG_GLOB"

# ---------------------------- Runner ---------------------------

_do_command() {
  case "$SUB" in
    today)
      v4=$(count_family_today v4 any)
      v6=$(count_family_today v6 any)
      total=$((v4+v6))
      pv4=$(percent "$v4" "$total"); pv6=$(percent "$v6" "$total")
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      echo "IPv4: $v4 (${pv4}%)"
      echo "IPv6: $v6 (${pv6}%)"
      echo "Total requests: $total"
      ;;
    today-success)
      v4=$(count_family_today v4 success)
      v6=$(count_family_today v6 success)
      total=$((v4+v6))
      pv4=$(percent "$v4" "$total"); pv6=$(percent "$v6" "$total")
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ -n "$SUCCESS_REGEX" ]] && echo "Success regex: $SUCCESS_REGEX" || echo "Success codes: $SUCCESS_CODES"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      echo "IPv4 (success-only): $v4 (${pv4}%)"
      echo "IPv6 (success-only): $v6 (${pv6}%)"
      echo "Total successful requests: $total"
      ;;
    today-fail)
      v4=$(count_family_today v4 fail)
      v6=$(count_family_today v6 fail)
      total=$((v4+v6))
      pv4=$(percent "$v4" "$total"); pv6=$(percent "$v6" "$total")
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ -n "$SUCCESS_REGEX" ]] && echo "Success complement of regex: $SUCCESS_REGEX" || echo "Fail = not in: $SUCCESS_CODES"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      echo "IPv4 (fail-only): $v4 (${pv4}%)"
      echo "IPv6 (fail-only): $v6 (${pv6}%)"
      echo "Total failed requests: $total"
      echo "Top 5 failure reasons:"
      top_fail_reasons_today 5
      ;;
    success-rate)
      s4=$(count_family_today v4 success)
      a4=$(count_family_today v4 any)
      s6=$(count_family_today v6 success)
      a6=$(count_family_today v6 any)
      r4=$(percent "$s4" "$a4")
      r6=$(percent "$s6" "$a6")
      stotal=$((s4+s6))
      atotal=$((a4+a6))
      ftotal=$((atotal-stotal))
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ -n "$SUCCESS_REGEX" ]] && echo "Success regex: $SUCCESS_REGEX" || echo "Success codes: $SUCCESS_CODES"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      echo "IPv4 success-rate: $s4 / $a4 (${r4}%)"
      echo "IPv6 success-rate: $s6 / $a6 (${r6}%)"
      echo "—"
      echo "TOTAL requests:        $atotal"
      echo "TOTAL successful:      $stotal"
      echo "TOTAL failed:          $ftotal"
      echo "Top 5 failure reasons (combined v4+v6):"
      top_fail_reasons_today 5
      ;;
    v4-today)
      v4=$(count_family_today v4 any)
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      echo "IPv4: $v4"
      ;;
    v6-today)
      v6=$(count_family_today v6 any)
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      echo "IPv6: $v6"
      ;;
    v4-today-success)
      v4=$(count_family_today v4 success)
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ -n "$SUCCESS_REGEX" ]] && echo "Success regex: $SUCCESS_REGEX" || echo "Success codes: $SUCCESS_CODES"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      echo "IPv4 (success-only): $v4"
      ;;
    v6-today-success)
      v6=$(count_family_today v6 success)
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ -n "$SUCCESS_REGEX" ]] && echo "Success regex: $SUCCESS_REGEX" || echo "Success codes: $SUCCESS_CODES"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      echo "IPv6 (success-only): $v6"
      ;;
    breakdown-today)
      if [[ -z "$FAMILY" ]]; then echo "Specify family: v4 or v6" >&2; exit 1; fi
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      echo "Status breakdown ($FAMILY):"
      status_breakdown_today "$FAMILY"
      ;;
    hourly)
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      hourly_breakdown_today
      ;;
    uniques)
      read -r u4 u6 < <(unique_ips_today)
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      [[ "$ANONIP" == "1" ]] && echo "IP anonymization: enabled (v4 /24, v6 /64)"
      echo "Unique IPv4 IPs: $u4"
      echo "Unique IPv6 IPs: $u6"
      ;;
    top-ips)
      if [[ -z "$FAMILY" ]] ; then echo "Specify family: v4 or v6" >&2; exit 1; fi
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      [[ "$ANONIP" == "1" ]] && echo "IP anonymization: enabled (v4 /24, v6 /64)"
      echo "Top IPs ($FAMILY), limit $TOP_LIMIT:"
      top_ips_today "$FAMILY" "$TOP_LIMIT"
      ;;
    top-fails)
      echo "Date: $DATEPAT${SINCE:+ from $SINCE}${UNTIL:+ to $UNTIL}"
      [[ "$IGNORE_BOTS" == "1" ]] && echo "Ignoring bots by UA regex"
      echo "Top 5 failure reasons (combined v4+v6):"
      top_fail_reasons_today 5
      ;;
    all)
      v4=$(count_all_family v4)
      v6=$(count_all_family v6)
      total=$((v4+v6))
      pv4=$(percent "$v4" "$total"); pv6=$(percent "$v6" "$total")
      echo "All logs (no date/time filter)"
      echo "IPv4: $v4 (${pv4}%)"
      echo "IPv6: $v6 (${pv6}%)"
      echo "Total requests: $total"
      ;;
    *)
      usage; exit 1 ;;
  esac
}

run_once() { _do_command; }

if [[ -n "$WATCH_INTERVAL" ]]; then
  while :; do
    clear || true
    run_with_spinner "Loading…" run_once
    sleep "$WATCH_INTERVAL"
  done
else
  run_with_spinner "Loading…" run_once
fi
