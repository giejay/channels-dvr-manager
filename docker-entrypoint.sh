#!/bin/sh
set -e

if [ -z "$API_PROXY_URL" ]; then
  echo "API_PROXY_URL is not set!" >&2
  exit 1
fi

envsubst '$API_PROXY_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

if [ "${CHANNELS_DVR_RUN_SCHEDULER:-true}" != "false" ]; then
  DVR_LOG_FILE="${DVR_LOG_FILE:-/var/log/dvr-scheduler.log}"
  mkdir -p "$(dirname "$DVR_LOG_FILE")"
  : > "$DVR_LOG_FILE"
  echo "Starting DVR scheduler... log file: $DVR_LOG_FILE"
  nohup sh -c 'DVR_LOG_FILE="$1" node /usr/share/nginx/html/scripts/dvr-scheduler.mjs 2>&1 | tee "$1"' sh "$DVR_LOG_FILE" &
fi

exec "$@"

