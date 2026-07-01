# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Barnabus VTT is a whiteboard-like virtual tabletop for the web, designed to be self-hosted. Multiple clients connect to a shared board over WebSockets and collaboratively place/move/draw objects (images, text, freehand SVG) on an infinite pan-and-zoom canvas, plus roll dice. It is a Svelte 5 frontend talking to a thin Bun/Express + `ws` backend.

The repo is a monorepo with three pieces:
- `frontend/` — Svelte 5 + Vite + TypeScript + Tailwind client (the bulk of the code).
- `backend/` — Bun-run WebSocket relay + Express HTTP server.
- `types.ts` (repo root) — the wire protocol shared by both. Both sides import it via `../types` / `../../types`.

## Project Memory

When working in these areas, read the relevant memory file first — they capture
the invariants that break things if you don't know them:

- frontend, canvas, objects, sync, syncing, copy/paste, drawing, images, board
  picker, presence UI → read `./CLAUDE/frontend.md`
- backend, server, relay, rooms, storage, SQLite, passphrase, admin, uploads,
  blobs, presence, wire protocol → read `./CLAUDE/backend.md`

## Working with GitHub issues

When fixing a GitHub issue, **do not close it**. Comment on the issue describing
the fix (what changed and where), then leave it **open** so the user can test and
close it themselves. The repo is `thomascgray/barnabus`; use the `gh` CLI.

## Commands

Both packages use **Bun** (note `bun.lock` / `bun.lockb`), not npm/node, even though `node` is also present in the Docker image.

### Repo root
- `bun install` — install root dev tooling (`concurrently`).
- `bun run dev` — **boots both frontend and backend together** (Vite HMR + `bun --watch`) with prefixed logs; one Ctrl-C stops both. This is the normal day-to-day dev loop — you do **not** need Docker for development.
- `bun run check` — runs both `frontend` and `backend` checks.
- `bun run migrate:json` — one-time import of legacy `backend/data/board.json` into SQLite (delegates to the backend script).

### Frontend (`cd frontend`)
- `bun install` — install deps.
- `bun run dev` — Vite dev server on **localhost:3000**.
- `bun run build` — production build (`vite build`).
- `bun run preview` — preview the production build.
- `bun run check` — type-check (`svelte-check` + `tsc -p tsconfig.node.json`). This is the only "test"/CI-style gate in the repo; run it after changes.

### Backend (`cd backend`)
- `bun install` — install deps.
- `bun run dev` — `bun --watch server.ts` (hot reload).
- `bun run start` — run the server once.
- `bun run build` — bundle to `./dist`.
- `bun run check` — type-check (`tsc --noEmit` against `backend/tsconfig.json`). Run after backend changes.
- `bun run migrate:json` — import legacy `backend/data/board.json` into SQLite.

The backend listens on a **single port** (`PORT`, default **8080**) serving both HTTP and the WebSocket endpoint at **`/ws`**, plus the built frontend as static files in production. Config is env-driven (`backend/config.ts`: `PORT`, `DB_PATH`, `UPLOADS_DIR`, `STATIC_DIR`). The frontend connects to the **same origin** (`ConnectionManager.connect()` builds `ws(s)://<host>/ws`); in dev the Vite proxy forwards `/ws`, `/api`, `/uploads` to the backend, so app code uses identical paths in dev and prod.

### Container
- `docker compose up --build` (repo root) — prod-like single-container run; serves everything on one port with a `/data` volume (SQLite db + uploads). This is for verifying the packaged artifact, **not** daily dev.

There is no test runner, linter config, or formatter wired up. "Passing CI" means `bun run check` is clean in both `frontend/` and `backend/`.

## Architecture

### The wire protocol (`/types.ts`)
Everything that crosses the network is a `Packet` — a discriminated union on `type` (`join`, `joinResponse`, `joinError`, `diceRoll`, `ping`, `pong`, `close`, `alterItem`, `addItem`, `removeItem`, `memberJoined`, `memberLeft`, and the canvas-management packets `switchCanvas`/`createCanvas`/`renameCanvas`/`deleteCanvas`/`canvasState`/`canvasList`). Every outbound packet carries an `identity` (`{ id, name? }`). The board itself is a map of `Object`s, where `Object = Object_Image | Object_Text | Object_SVG` (also a discriminated union on `type`). A board/room holds **many canvases** (issue #26); each `Object` belongs to one canvas and object packets are scoped to the sender's active canvas (see `CLAUDE/backend.md` / `CLAUDE/frontend.md`). When changing what gets synced, edit `types.ts` first and let both ends follow.

`PacketWithoutIdentity` is a mapped type used so the client can call `sendMessage({ type: ... })` without manually attaching identity — `ConnectionManager` injects it.

### Backend (`backend/server.ts`) — a stateful relay
The WebSocket server is attached to the Express HTTP server (one port) at `/ws`. It keeps in-memory `sockets` (id → WebSocket), `socketBoard` (id → board), and `socketMember` (id → presence) maps, and delegates durable state to a **`Storage`** implementation (`backend/storage/`). See `./CLAUDE/backend.md` for the full principles. Behavior:
- On `join`: **gated** — the board must exist and the passphrase verify, else `joinError`. On success it binds the socket to that board, replies with `joinResponse` (the board's objects as a `{ [id]: Object }` map, plus the presence snapshot), and broadcasts `memberJoined`.
- On `addItem` / `alterItem` / `removeItem`: **broadcasts to siblings in the same board only** (room-scoped), then writes through to `storage`.
- On `diceRoll`: broadcasts to same-board siblings only (not stored).
- **Multi-board rooms are implemented** (one socket = one board). Persistence is **SQLite** via `bun:sqlite` (`SqliteStorage`, `DB_PATH`, default `./data/barnabus.db`); rows are keyed by `(board_id, id)`. Schema is created by a migration runner (`storage/migrations.ts`). The legacy `JsonStorage` still exists behind the same interface. Image **bytes** go to a separate `BlobStore` (filesystem), not SQLite.
- Admin/board HTTP API (`/api/admin/boards`, `/api/boards/:id`, `/api/boards/:id/images`) is gated by `requireAdmin` (`BARNABUS_ADMIN_SECRET`) where applicable; `docs/self-hosting-plan.md` tracks the phase plan (Phases 0–5 done — including packaging/docs; Phase 6, extensible board content, is the remaining future work).
- Liveness: server pings clients every 30s and drops them if no pong within 5s.

The sender never receives its own mutations echoed back; the client applies its own changes locally and optimistically.

### Frontend — DOM is the source of truth (important)
This is the single most surprising convention. **Board objects are real DOM elements, not entries in a reactive store.** Each object is an HTML element whose `id` and `data-*` attributes (`data-x`, `data-y`, `data-width`, `data-objtype`, `data-src`, etc.) hold its state. Reactivity via Svelte runes (`$state`) is used only for *app/UI* state, not for the objects themselves.

Consequences to internalize before editing:
- `exportObject(el)` / `importObject(json)` in `global.svelte.ts` are the bridge between DOM elements and the `Object` wire type. Anything that syncs an object goes through these.
- `factories.svelte.ts` creates the DOM elements (`createImageElement`, `createTextElement`, `createFreehandSvgElement`) and is the only place that should construct objects.
- Position/size mutations are written directly to element `style.transform` and `data-*` attributes (see `updateObject`), not to a store.
- `loadDomIntoMemory()` caches references to singleton DOM nodes (camera, background, selection box, toolbars, dialogs) into the `dom` object once on mount; most modules read from `dom`.

### Frontend module layering
- `main.ts` → mounts `Container.svelte`, which **conditionally renders** `Landing.svelte` (the board picker) until `cmState.connectionState === "connected"`, then `App.svelte`. So the connection is initiated from `Landing` (join with `{ boardId, passphrase, name }`), and `App` only mounts once joined.
- `App.svelte` is the composition root. On mount it calls `loadDomIntoMemory()` and **wires raw DOM event listeners** (`mousedown/move/up`, `wheel`, `keydown`, `copy`, `paste`, `dragover`, `drop`) to functions in `listeners.svelte.ts`. The visual tree is `Background > Camera > { Objects, SelectionBox, SelectedObjectsWrapper, ResizerHandles }` plus the toolbars, presence strip, and overlay SVGs.
- `listeners.svelte.ts` — **low-level event router**. Translates raw mouse/keyboard/wheel/paste events into intent, manages mouse-button bookkeeping (`preMouseDown`/`postMouseUp`), and dispatches into interactions based on `appState.currentTool`. Pan/zoom math lives in `onWheel`. Paste handling converts pasted images to WebP and creates objects.
- `interactions.svelte.ts` — **the actual operations** (the largest file): selection box, dragging, drawing, resizing, text editing, grid toggling, duplication, locking, measuring, dice/image placement, z-ordering. These mutate the DOM objects and call `ConnectionManager.sendMessage(...)` to broadcast.
- `ui_updaters.svelte.ts` — keeps derived UI in sync after selection changes: the selected-objects bounding box, the popover/context menu, resize handles.
- `ConnectionManager.svelte.ts` — owns the single WebSocket, the client `identity` (a `nanoid`), `cmState` (idle/connecting/connected + current board), `presence`, and the inbound packet switch. Inbound `addItem`→`importObject`, `alterItem`→`updateObject`, `removeItem`→`removeObjectById`, `diceRoll`→push to `rollResults`, `ping`→reply `pong`, `joinResponse`→import + seed presence + persist membership, `joinError`→toast + back to picker, `memberJoined`/`memberLeft`→update `presence`. `membership.svelte.ts` persists joined boards to localStorage; `uploads.svelte.ts` does image uploads.
- `global.svelte.ts` — global `appState` (`iAppState`), the `dom` cache, and the export/import bridge functions.
- `utils.svelte.ts` — pure helpers: `screenToCanvas`/`canvasToScreen` coordinate transforms, camera math, overlap tests, freehand stroke→SVG path conversion, z-index `bringToFront`/`sendToBack`.
- `dice.svelte.ts` — `parseRoll(notation)` implements dice notation (basic, drop/keep, success-count, exploding) returning a `RollResult`.
- `factories.svelte.ts`, `config.svelte.ts`, `toast.svelte.ts`, `types.ts` — element construction, constants (`CLASSES`, `INITIAL_CAMERA_Z`), motion-animated toasts, and frontend-only enums/interfaces.
- `components/` — presentational Svelte components (toolbars, camera, background, objects container, selection box, resize handles, popover menu). Most behavior lives in the `.svelte.ts` modules above, not in the components.

### Coordinate system
There are two coordinate spaces: **screen** (raw client pixels) and **canvas** (world space, accounting for the camera's `x/y/z`). The camera's transform is stored on `dom.camera.dataset` (`x`, `y`, `z`). Always convert with `Utils.screenToCanvas` / `canvasToScreen` rather than mixing spaces. `appState` tracks both `lastMouseDownScreenPos` and `lastMouseDownCanvasPos`.

## Conventions & gotchas

- **`.svelte.ts` files**: logic modules use the `.svelte.ts` extension so Svelte 5 runes (`$state`, etc.) work in plain TypeScript. **Import them without the `.ts`** — e.g. `import * as Interactions from "./interactions.svelte"`. This pattern is used everywhere; match it.
- **DOM-as-state** (above): do not introduce a parallel reactive store for board objects without good reason — the whole pipeline (export/import/sync/persist) assumes objects live in the DOM with `data-*` attributes.
- **Optimistic local + broadcast-to-others**: when you act on an object, update the DOM locally *and* `sendMessage` the change; the server will not echo it back to you.
- **Element classes** come from the `CLASSES` constant in `config.svelte.ts` (`_object`, `_image_object`, etc.); object lookups use these class names and `data-objtype`.
- **WebP conversion**: pasted/added images are converted to WebP client-side (`webp-converter-browser`) before becoming objects.
- The backend uses CommonJS `require` interop (express/cors) alongside ESM imports — Bun tolerates this; keep it consistent with the existing file if editing `server.ts`.
- Persistence goes through the `Storage` interface (`backend/storage/`), backed by SQLite (`bun:sqlite`); each object is one row keyed by `(board_id, id)`, upserted per mutation. Uploaded image bytes go to a separate `BlobStore` (filesystem, content-addressed). The SQLite db and uploads live under `./data/` locally and the `/data` volume in the container — both gitignored. `backend/data/board.json` is kept only as the legacy seed for `migrate:json`.
- Self-hosting effort: multi-board rooms, passphrases, admin API, presence, image upload, and packaging/docs (multi-stage Dockerfile + compose + self-hoster README) are all **done** (Phases 0–5). The remaining future work is Phase 6 (extensible non-canvas board content). See `docs/self-hosting-plan.md` for the plan, and `./CLAUDE/frontend.md` / `./CLAUDE/backend.md` for the principles.
