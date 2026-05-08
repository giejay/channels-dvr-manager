# syntax=docker/dockerfile:1.4

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Build arguments that can be passed during docker build
ARG VITE_STREAM_URL
ARG VITE_UNSPLASH_CLIENT_ID

# Make them available as environment variables during build
ENV VITE_STREAM_URL=$VITE_STREAM_URL
ENV VITE_UNSPLASH_CLIENT_ID=$VITE_UNSPLASH_CLIENT_ID

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:1.25-alpine AS prod
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist .
COPY ./nginx.conf.template /etc/nginx/templates/default.conf.template
COPY ./docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh
ENV API_PROXY_URL=""
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

