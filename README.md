# Quiz Game

A real-time, multiplayer trivia game in the spirit of PlayStation Buzz! and
Kahoot. One screen hosts the game (TV/projector), players join from their phones,
and an admin drives the game from a phone remote.

- **Home** (`/`) — a small landing page with links to the three views.
- **Host / TV screen** (`/host`) — shows the join code + QR code in the lobby, then
  the current question, countdown, and leaderboard.
- **Player** (`/play`) — mobile-first join screen (nickname + code), then big
  colored A/B/C/D answer buttons.
- **Admin remote** (`/admin`) — enter the game code, choose settings, start the
  game, reveal answers, advance questions, and end the game.

Real-time updates run over WebSockets (Socket.IO). Everything runs from a single
origin, so it fits comfortably on a free hosting tier.

## Tech stack

- **Monorepo:** npm workspaces (`packages/shared`, `packages/server`, `packages/client`)
- **Server:** Node.js + TypeScript, Express, Socket.IO, run directly with `tsx`
- **Client:** React 18 + TypeScript, React Router, Vite
- **Shared:** TypeScript types + the typed socket event contract
- **Tests:** Vitest (server + shared), Vitest + Testing Library (client)

## Prerequisites

- Node.js >= 20
- npm (comes with Node)

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` runs the server on `http://localhost:3000` and the Vite dev server
on `http://localhost:5173` (with the Socket.IO connection proxied to the server).
Open:

- Home (links to all views): <http://localhost:5173/>
- Host / TV: <http://localhost:5173/host>
- Player: <http://localhost:5173/play>
- Admin: <http://localhost:5173/admin>

To play across devices on your local network, use your machine's LAN IP instead
of `localhost` (the QR code on the host screen uses the browser's origin).

## Questions

Questions are read at runtime from `packages/server/data/questions.json` — a
committed file, so the app has no runtime dependency on any external service.

To refresh the pool from the [Open Trivia DB](https://opentdb.com):

```bash
npm run questions:import                       # ~50 multiple-choice + ~15 true/false
npm run questions:import -- --multiple 50 --boolean 20
```

The import script fetches questions, decodes them, shuffles the options (tracking
the correct answer), de-duplicates, validates, and overwrites the JSON file.
Open Trivia DB is rate-limited, so requests are spaced out and each is capped at
50 questions.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run server + client with hot reload |
| `npm run build` | Build the client bundle into `packages/client/dist` |
| `npm start` | Run the production server (serves the built client + WebSockets) |
| `npm test` | Run all workspace test suites |
| `npm run typecheck` | Type-check all workspaces |
| `npm run lint` | Lint the whole repo |
| `npm run questions:import` | Refresh questions from Open Trivia DB |

## Production build

```bash
npm run build   # build the client
npm start       # serve client + WebSockets from one origin (PORT, default 3000)
```

In production the server serves the built client from `packages/client/dist` as
static files, with an SPA fallback so client-side routes (`/play`, `/admin`)
work on refresh. The Socket.IO endpoint lives on the same origin.

## Deploy to Render (free tier)

The repo includes a [`render.yaml`](./render.yaml) Blueprint.

1. Push this repo to GitHub.
2. In Render, create a new **Blueprint** and point it at the repo (or create a
   **Web Service** manually with the settings below).
3. Render reads `render.yaml`:
   - **Build:** `npm install && npm run build`
   - **Start:** `npm start`
   - **Health check:** `/healthz`
   - **Plan:** free

Render provides `PORT` automatically. WebSockets work on the free tier; note the
free instance sleeps after inactivity, so the first request after idle takes a
few seconds to wake.

## Project structure

```
packages/
  shared/   Types + socket event contract (consumed as TS source)
  server/   Express + Socket.IO game server, question loader, import script
    data/questions.json   Committed question pool
  client/   React app (host, player, admin views)
```
