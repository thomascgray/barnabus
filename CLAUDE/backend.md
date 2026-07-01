# Backend principles

## Overview

The backend is a single Bun process: an Express HTTP server with a `ws`
WebSocket relay bound to the **same port** (`/ws`), serving the built frontend
as static files in production. It is a **stateful relay** — it keeps in-memory
socket/room/presence maps and delegates durable state to a `Storage`
implementation. Config is env-driven (`backend/config.ts`).

## Wire protocol is the source of truth

Everything crossing the network is a `Packet` (discriminated union on `type`) in
the root `types.ts`, imported by both ends. **When changing what syncs, edit
`types.ts` first** and let both sides follow. Board objects are
`Object = Object_Image | Object_Text | Object_SVG`.

## Rooms, canvases & broadcasting

- **One socket = one board + one canvas.** The board is bound at `join`
  (`socketBoard[id]`); a board holds **many canvases** (issue #26) and the socket
  is also bound to the canvas it's viewing (`socketCanvas[id]`). Packets after
  join carry no `boardId`/`canvasId` — the server already knows both from the
  socket.
- **Object mutations are canvas-scoped.** `addItem`/`alterItem`/`removeItem` (and
  the transient `imagePreview`) broadcast only to siblings viewing the **same
  canvas** (`socketsInCanvas`) and persist under `(board, canvas)`. Two clients on
  different canvases of the same room never see each other's object edits.
- **Presence and dice are room-wide.** `memberJoined`/`memberLeft`/`diceRoll` and
  the `canvasList` broadcast span every canvas in the board (`socketsInRoom`) —
  switching canvas doesn't change who's "here" or interrupt shared dice.
- **Canvas ops** (`switchCanvas`/`createCanvas`/`renameCanvas`/`deleteCanvas`):
  the client mints new canvas ids (like object ids). The server replies to the
  actor with `canvasState` (the target canvas's objects) and broadcasts
  `canvasList` to the whole room. Guards: never delete a board's **first** canvas
  (min position) or its **last** remaining one; anyone viewing a deleted canvas is
  force-moved to the first via `canvasState`.
- **The sender never receives its own object mutation back** — clients apply their
  own changes optimistically. (Canvas ops *do* echo `canvasState`/`canvasList` to
  the actor, since it needs the new objects/list.)
- Liveness: ping every 30s, drop a client with no pong within 5s.

## Boards & auth

- **Join is gated.** A board must already exist (no auto-create except the
  startup `DEFAULT_BOARD_ID`) and the passphrase must verify, else the server
  replies `joinError`.
- **Open boards** have an empty `passphrase_hash`; `verifyPassphrase` returns
  `true` for them (this is why the default board needs no passphrase).
  Passphrases are hashed/verified with `Bun.password.hashSync` /
  `verifySync` (sync, to match the storage interface).
- **Admin API** is gated by one `requireAdmin` middleware checking
  `Authorization: Bearer <BARNABUS_ADMIN_SECRET>`. Empty secret ⇒ admin disabled
  (503). The check lives behind that single middleware so real admin accounts can
  replace it later without touching routes.
- **Route ordering matters:** all `/api/*` and `/uploads` routes must be
  registered **before** the SPA catch-all (`sendFile(index.html)`), or the
  catch-all swallows them.

## Presence is ephemeral

The per-room member list lives only in memory (`socketMember`), **never in
SQLite**. On join the server adds the member, returns the snapshot in
`joinResponse`, and broadcasts `memberJoined`; on disconnect/timeout it removes
them and broadcasts `memberLeft`. A board with nobody on it has an empty list.

## Persistence (`backend/storage/`)

- The `Storage` interface is **synchronous** (both `bun:sqlite` and `fs` are
  sync, and the relay call sites are sync). A future async backend (e.g.
  Postgres) would widen these to `Promise`s.
- `SqliteStorage` is the real implementation; `JsonStorage` is the legacy
  single-board behavior kept behind the same interface.
- **One row per object**, keyed by `(board_id, id)` with a `canvas_id` column
  (issue #26), upserted per mutation — matches the per-object `addItem`/`alterItem`
  write pattern (no whole-board rewrites). Reads are filtered by
  `(board_id, canvas_id)`. Schema changes go through the ordered migration runner
  (`storage/migrations.ts`); migration v3 added the `canvases` table + `canvas_id`
  and back-filled every existing board with one `'default'` canvas.
- **Canvases** live in their own table keyed by `(board_id, id)`, ordered by
  `position` (creation order). `ensureDefaultCanvas` guarantees ≥1 canvas per
  board; `createBoard` seeds one. `'default'` is only the back-fill id — "the
  first canvas" is decided by ordering, not that magic id.
- Deleting a board cascades its canvas + object rows (FK `ON DELETE CASCADE`, with
  `PRAGMA foreign_keys = ON`). Objects have **no** FK to `canvases` (SQLite can't
  add one via `ALTER`), so `deleteCanvas` removes a canvas's objects explicitly.

## Image blobs are separate from SQLite

`BlobStore` (filesystem) is distinct from the `Storage` (SQLite). Image **bytes**
live on disk at `<uploadsDir>/<boardId>/<sha256>.webp` (content-addressed →
dedup; board-scoped → a board delete removes the whole dir). SQLite only ever
stores the **URL** in `Object_Image.src`. An S3/R2 backend would be a later
`BlobStore` swap. Upload auth reuses `verifyPassphrase` (via the
`X-Board-Passphrase` header); the endpoint validates WebP magic bytes and a
`MAX_UPLOAD_MB` size limit, and takes raw bytes (no multipart).

## Topology & config

- **Single port** (`PORT`, default 8080) serves HTTP + `/ws` + static frontend.
  Frontend connects same-origin; in dev the Vite proxy forwards
  `/ws`,`/api`,`/uploads` to the backend, so app code is identical in dev and
  prod (differs only by env vars).
- Local dev loads the **root `.env`** via `--env-file=../.env` in the backend
  `dev` script (keeps `cwd` backend-relative so `./data/` paths are unchanged).
  In production these come from real env vars, not `.env`.
- Express/cors use CommonJS `require` interop alongside ESM imports — Bun
  tolerates it; keep it consistent when editing `server.ts`.
