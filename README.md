# channels-dvr-manager

channels-dvr-manager is a web-based management UI for Channels DVR servers. It provides features missing from the default Channels DVR web interface, such as creating manual recordings, advanced schedule management, and bulk operations.

## ⚠️ Disclaimer

**This codebase has been heavily developed with AI assistance.** While care has been taken to ensure functionality and quality, please be aware that:
- Code may contain inefficiencies or unconventional patterns
- Testing may be incomplete
- Documentation may not be exhaustive
- There may be edge cases not covered

Use at your own risk and feel free to review, refactor, or improve the code as needed.

## Features

- Create manual recordings with custom start/end times, multiple channels, and repeat options
- Search and select channels with logos and filtering
- View, filter, and manage all scheduled recordings in a data table
- Edit or delete individual or multiple scheduled recordings
- Dark/light mode toggle with automatic detection
- Proxy support for secure API access to your Channels DVR server
- Docker-ready for easy deployment

## How to Run

1. Set the `API_PROXY_URL` environment variable in your `.env` file or directly in your `docker-compose.yml` to match your Channels DVR instance (e.g., `http://192.168.2.118:8089`).
2. (Optional) Set `VITE_UNSPLASH_CLIENT_ID` if you want to enable image search.
3. Start the app using Docker Compose:

```sh
docker compose up -d
```

The app will be available at [http://localhost:8080](http://localhost:8080) by default.

### Environment Variables

The app uses the following build-time environment variables (set via `.env` file or CLI):

- `VITE_STREAM_URL` - Stream base URL for video playback (e.g., `http://192.168.2.118:8089`)
  - If not set, the app auto-detects using the current host on port 8089
  - Used in the Guide tab for streaming live TV
- `VITE_UNSPLASH_CLIENT_ID` - Unsplash API key for image search in manual recordings
  - Get one from: https://unsplash.com/oauth/applications

### Building with Environment Variables

You can pass environment variables during the build process:

```sh
# Using command line
VITE_STREAM_URL=http://192.168.2.118:8089 npm run build

# Using .env file (Vite reads it automatically)
echo "VITE_STREAM_URL=http://192.168.2.118:8089" > .env
npm run build

# Docker example
docker build --build-arg VITE_STREAM_URL=http://192.168.2.118:8089 .
```

## Local Development

### Prerequisites
- Node.js 18+ and npm
- Channels DVR server with API access

### Project Setup & Development

```sh
npm install
npm run dev
```

### Production Build

```sh
npm run build
```

---
