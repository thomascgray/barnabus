# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Barnabus VTT is a whiteboard-like virtual tabletop for the web, designed to be self-hosted. Multiple clients connect to a shared board over WebSockets and collaboratively place/move/draw objects (images, text, freehand SVG) on an infinite pan-and-zoom canvas, plus roll dice. It is a Svelte 5 frontend talking to a thin Bun/Express + `ws` backend.

The repo is a monorepo with three pieces:
- `frontend/` — Svelte 5 + Vite + TypeScript + Tailwind client (the bulk of the code).
- `backend/` — Bun-run WebSocket relay + Express HTTP server.
- `types.ts` (repo root) — the wire protocol shared by both. Both sides import it via `../types` / `../../types`.

## Commands

Both packages use **Bun** (note `bun.lock` / `bun.lockb`), not npm/node, even though `node` is also present in the Docker image.

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
- `bun run docker:build` / `bun run docker:run` — containerized run (exposes 5000 + 8080).

The backend listens on **HTTP 5000** and **WebSocket 8080**. The frontend connects to `ws://localhost:8080` by default (see `Landing.svelte`).

There is no test runner, linter config, or formatter wired up. "Passing CI" means `bun run check` is clean in `frontend/`.

## Architecture

### The wire protocol (`/types.ts`)
Everything that crosses the network is a `Packet` — a discriminated union on `type` (`join`, `joinResponse`, `diceRoll`, `ping`, `pong`, `close`, `alterItem`, `addItem`). Every outbound packet carries an `identity` (`{ id, name? }`). The board itself is a map of `Object`s, where `Object = Object_Image | Object_Text | Object_SVG` (also a discriminated union on `type`). When changing what gets synced, edit `types.ts` first and let both ends follow.

`PacketWithoutIdentity` is a mapped type used so the client can call `sendMessage({ type: ... })` without manually attaching identity — `ConnectionManager` injects it.

### Backend (`backend/server.ts`) — a stateful relay
Single file. Holds two in-memory maps: `sockets` (id → WebSocket) and `boardInformation` (the authoritative board, id → `Object`). Behavior:
- On `join`: registers the socket and replies with `joinResponse` containing the full current board.
- On `addItem` / `alterItem`: updates `boardInformation`, **broadcasts to all *other* clients** (siblings), then persists.
- On `diceRoll`: broadcasts to other clients only (not stored).
- Persistence is a plain JSON file at `backend/data/board.json`, rewritten on every mutation via `writeBoardStateToFile()` and loaded on startup. This is the durability story — there is no database.
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
- `main.ts` → mounts `Container.svelte` → renders `App.svelte` (the only screen currently; `Landing.svelte` connect-screen is commented out and connection is implicit).
- `App.svelte` is the composition root. On mount it calls `loadDomIntoMemory()` and **wires raw DOM event listeners** (`mousedown/move/up`, `wheel`, `keydown`, `paste`) to functions in `listeners.svelte.ts`. The visual tree is `Background > Camera > { Objects, SelectionBox, SelectedObjectsWrapper, ResizerHandles }` plus the toolbars and overlay SVGs.
- `listeners.svelte.ts` — **low-level event router**. Translates raw mouse/keyboard/wheel/paste events into intent, manages mouse-button bookkeeping (`preMouseDown`/`postMouseUp`), and dispatches into interactions based on `appState.currentTool`. Pan/zoom math lives in `onWheel`. Paste handling converts pasted images to WebP and creates objects.
- `interactions.svelte.ts` — **the actual operations** (the largest file): selection box, dragging, drawing, resizing, text editing, grid toggling, duplication, locking, measuring, dice/image placement, z-ordering. These mutate the DOM objects and call `ConnectionManager.sendMessage(...)` to broadcast.
- `ui_updaters.svelte.ts` — keeps derived UI in sync after selection changes: the selected-objects bounding box, the popover/context menu, resize handles.
- `ConnectionManager.svelte.ts` — owns the single WebSocket, the client `identity` (a `nanoid`), `cmState` (idle/connecting/connected), and the inbound packet switch. Inbound `addItem`→`importObject`, `alterItem`→`updateObject`, `diceRoll`→push to `rollResults`, `ping`→reply `pong`.
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
- The backend uses CommonJS `require` interop alongside ESM imports — Bun tolerates this; keep it consistent with the existing file if editing `server.ts`.
- Persistence is whole-file JSON rewrite per mutation; `backend/data/board.json` is the saved board state.
