#!/bin/sh
set -e

if [ -z "$API_PROXY_URL" ]; then
  echo "API_PROXY_URL is not set!" >&2
  exit 1
fi

envsubst '$API_PROXY_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

if [ "${CHANNELS_DVR_RUN_SCHEDULER:-true}" != "false" ]; then
  echo "Starting DVR scheduler..."
  nohup node /usr/share/nginx/html/scripts/dvr-scheduler.mjs > /var/log/dvr-scheduler.log 2>&1 &
fi

exec "$@"

