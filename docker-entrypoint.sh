#!/bin/sh
set -e
# Substitute env vars in nginx config template
if [ -z "$API_PROXY_URL" ]; then
  echo "API_PROXY_URL is not set!" >&2
  exit 1
fi
envsubst '$API_PROXY_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec "$@"

