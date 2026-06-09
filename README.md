# HM Planning Poker

Disposable, real-time planning-poker rooms. React + Express + Socket.io, durable SQLite
room state on a persistent volume.

## Develop
    nvm use
    npm install
    npm run dev:server       # :5099 (creates ./data/rooms.db)
    npm run dev:client       # Vite dev server, proxies /socket.io to :5099

## Test
    npm test                 # unit + integration across workspaces (in-memory SQLite)

## Build & run
    npm run build
    DATA_DIR=./data npm start

## Deploy
Push to `main`; Render (or Railway) auto-deploys the Docker image. State lives in a SQLite
DB on a persistent disk/volume mounted at `/data` (`DATA_DIR=/data`) — no external database
service. See `render.yaml` / `railway.toml`. An optional `.github/workflows/deploy.yml`
publishes to `tools.hmn.md` for temporary internal pre-launch testing only.
