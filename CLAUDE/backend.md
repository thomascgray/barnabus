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

## Rooms & broadcasting

- **One socket = one board.** The board is bound at `join` (`socketBoard[id]`).
  Packets after join carry no `boardId` — the server already knows the socket's
  room.
- **Broadcasts are room-scoped.** `addItem`/`alterItem`/`removeItem`/`diceRoll`
  go only to *sibling* sockets in the **same** board.
- **The sender never receives its own mutation back** — clients apply their own
  changes optimistically.
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
- **One row per object**, keyed by `(board_id, id)`, upserted per mutation —
  matches the per-object `addItem`/`alterItem` write pattern (no whole-board
  rewrites). Schema changes go through the ordered migration runner
  (`storage/migrations.ts`).
- Deleting a board cascades its object rows (FK `ON DELETE CASCADE`, with
  `PRAGMA foreign_keys = ON`).

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
