# syntax=docker/dockerfile:1.4

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_STREAM_URL
ARG VITE_UNSPLASH_CLIENT_ID

ENV VITE_STREAM_URL=$VITE_STREAM_URL
ENV VITE_UNSPLASH_CLIENT_ID=$VITE_UNSPLASH_CLIENT_ID

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:1.25-alpine AS prod
RUN apk add --no-cache nodejs
WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist .
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/scripts ./scripts
COPY ./nginx.conf.template /etc/nginx/templates/default.conf.template
COPY ./docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

ENV API_PROXY_URL=""
ENV CHANNELS_DVR_URL="http://www.channels.local"
ENV CHANNELS_DVR_CRON="0 3 * * *"
ENV CHANNELS_DVR_RUN_IMMEDIATELY="true"
ENV CHANNELS_DVR_RUN_SCHEDULER="true"

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

