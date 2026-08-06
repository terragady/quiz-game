# Quiz Game

[![Live demo](https://img.shields.io/badge/▶_Live_demo-quiz.michalik.no-2ea44f?style=for-the-badge)](https://quiz.michalik.no)

[![CI](https://img.shields.io/github/actions/workflow/status/terragady/quiz-game/ci.yml?branch=main&label=CI&logo=github)](https://github.com/terragady/quiz-game/actions/workflows/ci.yml)
![GitHub top language](https://img.shields.io/github/languages/top/terragady/quiz-game)
![GitHub repo size](https://img.shields.io/github/repo-size/terragady/quiz-game)
![GitHub last commit](https://img.shields.io/github/last-commit/terragady/quiz-game)

![TypeScript](https://img.shields.io/github/package-json/dependency-version/terragady/quiz-game/dev/typescript?logo=typescript&logoColor=white&label=TypeScript)
![React](https://img.shields.io/github/package-json/dependency-version/terragady/quiz-game/react?filename=packages%2Fclient%2Fpackage.json&logo=react&logoColor=61DAFB&label=React)
![Vite](https://img.shields.io/github/package-json/dependency-version/terragady/quiz-game/dev/vite?filename=packages%2Fclient%2Fpackage.json&logo=vite&logoColor=white&label=Vite)
![Socket.IO](https://img.shields.io/github/package-json/dependency-version/terragady/quiz-game/socket.io?filename=packages%2Fserver%2Fpackage.json&logo=socketdotio&logoColor=white&label=Socket.IO)
![Express](https://img.shields.io/github/package-json/dependency-version/terragady/quiz-game/express?filename=packages%2Fserver%2Fpackage.json&logo=express&logoColor=white&label=Express)
![npm workspaces](https://img.shields.io/badge/npm-workspaces-CB3837?logo=npm&logoColor=white)
![Node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fterragady%2Fquiz-game%2Fmain%2Fpackage.json&query=%24.engines.node&logo=nodedotjs&logoColor=white&label=Node&color=5FA04E)

A real-time, multiplayer trivia party game. One screen hosts the game
(TV/projector) and players join from their phones. The host both displays the
game and drives it (settings, start, reveal, next, end) — no separate remote
needed.

**🎮 Live demo: <https://quiz.michalik.no>** — open `/host` on a big screen and
share the code, then have everyone join from their phones at `/play`. (Free
hosting tier: the first load after an idle period takes a few seconds to wake.)

- **Home** (`/`) — a small landing page with links to the views.
- **Host / TV screen** (`/host`) — shows the join code + QR code and floating
  player chips in the lobby, along with **game settings and a Start button**.
  During play it shows the current question, countdown, per-answer distribution,
  and leaderboard, with **Reveal / Next / End** controls. Optional
  **auto-advance** moves through reveal → leaderboard → next question on a timer.
- **Player** (`/play`) — mobile-first join screen (nickname + code), then big
  colored answer buttons.

Each host screen is its own **room** with a unique code; refreshing the TV
rejoins the same game, and a "New game" button starts a fresh one. Some
questions are **picture questions** — guess the flag, the landmark, or the
famous person — with the image shown on the host screen.

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

To play across devices on your local network, use your machine's LAN IP instead
of `localhost` (the QR code on the host screen uses the browser's origin).

## Questions

At runtime the game pool is the merge of two committed files, so the app has no
runtime dependency on any external service:

- `packages/server/data/curated-questions.json` — a hand-maintained set of
  English questions focused on Europe, Norway, and Poland, plus picture
  questions (flags, landmarks, and famous people) whose images are served
  locally from `packages/client/public/images`. Edit this by hand; the importer
  never touches it.
- `packages/server/data/questions.json` — the [Open Trivia DB](https://opentdb.com)
  dump, produced (and overwritten) by the import script.

Options are shuffled when the pool loads, so the correct answer never sits in a
fixed slot. To refresh the imported pool:

```bash
npm run questions:import                        # ~150 multiple-choice + ~50 true/false
npm run questions:import -- --multiple 50 --boolean 20
```

The import script fetches questions, decodes them, shuffles the options (tracking
the correct answer), de-duplicates, validates, and overwrites `questions.json`
only. Open Trivia DB is rate-limited, so requests are spaced out and each is
capped at 50 questions.

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
static files, with an SPA fallback so client-side routes (`/host`, `/play`)
work on refresh. The Socket.IO endpoint lives on the same origin.

## Deploy to Render (free tier)

The repo includes a [`render.yaml`](./render.yaml) Blueprint.

1. Push this repo to GitHub.
2. In Render, create a new **Blueprint** and point it at the repo (or create a
   **Web Service** manually with the settings below).
3. Render reads `render.yaml`:
   - **Build:** `npm install --include=dev && npm run build`
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
    data/curated-questions.json   Hand-maintained EU/NO/PL + picture questions
    data/questions.json           Imported Open Trivia DB dump
  client/   React app (home, host, player views)
```
