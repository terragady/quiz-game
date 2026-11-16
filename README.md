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
famous person — with the image shown on the host screen — and some are
**name-that-tune questions**, where the host screen plays a short melody.

The host can switch these on or off before each game:

- Show the category before each question (a short spinning reveal).
- Include name-that-tune questions (about one question in five).
- Show who picked which answer. When it's off, the TV only shows how many
  people picked each answer.
- Wrong answers cost 250 points (never below zero; not answering costs nothing).

Players can send emoji reactions from their phones between questions, and they
float up on the TV. Phones buzz when a question opens and when the answer is
revealed (on Android; iPhones don't allow it), and both the TV and the phones
stay awake during a game. The final screen has a podium and a few awards
(fastest answer, most correct, longest streak). Within a room, questions don't repeat
from one game to the next until the pool runs out.

Real-time updates run over WebSockets (Socket.IO). Everything runs from a single
origin, so it fits comfortably on a free hosting tier.

## Tech stack

- **Monorepo:** npm workspaces (`packages/shared`, `packages/server`, `packages/client`)
- **Server:** Node.js + TypeScript, Express, Socket.IO, run directly with `tsx`
- **Client:** React 19 + TypeScript, React Router, Vite
- **Shared:** TypeScript types + the typed socket event contract
- **Tests:** Vitest (server + shared), Vitest + Testing Library (client)

## Prerequisites

- Node.js 26 (the current LTS); `.nvmrc` pins it for nvm and fnm users
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

The game plays from one committed file, `packages/server/data/questions.json`
(about 7,300 questions), so it has no runtime dependency on any external
service. That file is built from three source files:

- `curated-questions.json` — a hand-maintained set of English questions focused
  on Europe, Norway, and Poland, plus picture questions (flags, landmarks, and
  famous people) whose images are served locally from
  `packages/client/public/images`. Edit this by hand; the importers never touch
  it.
- `opentdb-questions.json` — imported from [Open Trivia DB](https://opentdb.com).
  The importer overwrites this file.
- `trivia-api-questions.json` — imported from
  [The Trivia API](https://the-trivia-api.com). The importer adds to this file.

All of them live in `packages/server/data`. Building the pool drops duplicates:
questions with the same text, and questions that ask the same thing in other
words with the same answer (e.g. "capital of Finland" and "capital city of
Finland"). Curated questions win over imported ones. Imported categories are
grouped into a short list (Geography, History, Science & Nature, and so on).

Name-that-tune questions are written out as notes in `curated-questions.json`,
so there are no audio files. Only out-of-copyright tunes (classical pieces,
folk songs, anthems) belong there:

```json
"melody": { "bpm": 132, "notes": "E4:1 E4:1 F4:1 G4:1 R:1 C4:2" }
```

Each note is a pitch and octave (`C4`, `F#5`, `Bb3`) or `R` for a rest,
followed by its length in beats.

```bash
npm run questions:import                                 # Open Trivia DB
npm run questions:import -- --multiple 3000 --boolean 500
npm run questions:import:trivia-api -w @quiz/server -- --count 500
npm run questions:build -w @quiz/server                  # rebuild the pool only
```

Both importers rebuild the pool when they finish. The APIs are rate-limited, so
requests are spaced out and capped at 50 questions each.

## Scripts

| Command                    | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `npm run dev`              | Run server + client with hot reload                              |
| `npm run build`            | Build the client bundle into `packages/client/dist`              |
| `npm start`                | Run the production server (serves the built client + WebSockets) |
| `npm test`                 | Run all workspace test suites                                    |
| `npm run typecheck`        | Type-check all workspaces                                        |
| `npm run lint`             | Lint the whole repo and check formatting                         |
| `npm run lint:fix`         | Fix lint and formatting issues where possible                    |
| `npm run format`           | Format the code with oxfmt                                       |
| `npm run questions:import` | Refresh the Open Trivia DB questions                             |

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

## Future ideas

- Custom questions: let people write their own question sets and play them.
- Questions with more than one right answer, where players pick several.

## Project structure

```
packages/
  shared/   Types + socket event contract (consumed as TS source)
  server/   Express + Socket.IO game server, question loader, import script
    data/curated-questions.json   Hand-maintained EU/NO/PL + picture questions
    data/opentdb-questions.json   Imported from Open Trivia DB
    data/trivia-api-questions.json  Imported from The Trivia API
    data/questions.json           The merged pool the game plays from
  client/   React app (home, host, player views)
```
