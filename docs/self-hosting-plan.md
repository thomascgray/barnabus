# Self-Hosting & Multi-Board Implementation Plan

> Status: **proposal / spec**. No code has been changed yet. This document is the
> blueprint we'll review and adjust before building. It assumes the architecture
> described in `CLAUDE.md`.

## 1. Goal

Turn Barnabus VTT from a two-process, single-global-board, JSON-file app that
runs on `localhost` into something a non-developer can self-host:

> "Download one thing, `docker run` it (or `docker compose up`), point a domain
> at it, and now you have a server where you create boards, hand out a link + a
> passphrase, and your friends join with their own usernames."

And do it **without wrecking the day-to-day dev experience** (Vite HMR on the
front, `bun --watch` on the back).

### Decisions locked in (from planning)
- **Persistence:** SQLite (single file on a mounted volume). No separate DB
  process — keeps it to **one container**.
- **Data model:** first-class **Board** abstraction. The server admin creates
  boards; each board has a shareable **join link** and a **passphrase**. Joiners
  supply their own **username**. No global user accounts.
- **Board is a container, not a canvas.** Today a board holds canvas objects.
  The schema/protocol must make it cheap to later attach *other* content to a
  board (text snippets, notes, handouts, initiative trackers, …) without
  reworking rooms or auth. This is the main reason to build the abstraction now.
- **Client remembers memberships.** The frontend persists, per joined board:
  `{ boardId, name, passphrase, username }` so you can hop between your boards.

### Explicit non-goals (for this effort)
- No real user accounts / SSO / email. "Identity" stays the per-connection
  `nanoid`; the username is a per-board display name.
- No horizontal scaling / multi-instance. One container, in-process room state,
  SQLite. (The data layer is abstracted so Postgres + multi-instance is a *later*
  option, not a rewrite.)
- No TLS *inside* the container — the app speaks plain HTTP/WS and self-hosters
  put a reverse proxy (Caddy/nginx/Traefik) in front for HTTPS. Documented, not
  built.

---

## 2. Where we are today (baseline)

- **Two ports:** Express HTTP on `5000`, `ws` WebSocket server on `8080`
  (`backend/server.ts`). Frontend hard-connects to `ws://localhost:8080`.
- **One implicit global board.** `boardInformation` is a single `{ [id]: Object }`
  map. Every `addItem`/`alterItem` broadcasts to *all other* sockets — there is
  no concept of rooms.
- **Persistence = whole-file JSON rewrite** of `backend/data/board.json` on every
  mutation.
- **No join gating.** `join` just registers the socket and returns the whole
  board. No passphrase, no username.
- **Frontend connection is hardcoded & the landing screen is commented out.**
  `Container.svelte` renders `App` directly; `Landing.svelte` exists but is dead.
- **DOM-as-state** for board objects (see `CLAUDE.md`). This convention is fine
  and stays — switching boards just means tearing down the DOM objects and
  re-`importObjects()`-ing the new board's set.

Three things have to change structurally: **ports → one**, **persistence → SQLite
behind an interface**, **board → a real, gated, multi-instance abstraction.**

---

## 3. Target architecture

### 3.1 Topology — one container, one port

```
                          ┌──────────────────────────────────────────┐
   browser  ──HTTPS/WSS──▶ │  reverse proxy (Caddy/nginx) — user's     │
                          │  responsibility, terminates TLS           │
                          └───────────────┬──────────────────────────┘
                                          │ HTTP/WS, one port
                          ┌───────────────▼──────────────────────────┐
                          │  barnabus container (Bun)                 │
                          │                                           │
                          │  Bun HTTP server (single PORT)            │
                          │   ├─ GET  /            → built frontend   │
                          │   │                      (static, Vite    │
                          │   │                      build output)    │
                          │   ├─ /api/*            → admin + board     │
                          │   │                      lookup endpoints  │
                          │   └─ upgrade /ws       → WebSocket relay   │
                          │                          (rooms)           │
                          │                                           │
                          │  data layer (storage interface)           │
                          │   └─ SQLite  →  /data/barnabus.db (volume) │
                          └───────────────────────────────────────────┘
```

**Single port** is the key packaging change. Today's split (5000 + 8080) is
painful behind a reverse proxy and for `docker run -p`. We attach the WebSocket
server to the *same* HTTP server and serve the built frontend from it, so the
whole app is one published port and one origin.

- With `ws`: `new WebSocketServer({ server, path: "/ws" })` where `server` is the
  Node/Bun HTTP server Express is listening on (or handle the `upgrade` event
  ourselves). Either keep Express for routing or move to `Bun.serve` (which has
  first-class `websocket` + `fetch` on one port). **Recommendation:** keep the
  current Express + `ws` shape for the first pass (smallest diff, the CommonJS
  interop already works) and just bind `ws` to the shared server; revisit
  `Bun.serve` only if we want to drop Express.
- Frontend connects to **same-origin**: `` `${location.protocol === "https:" ?
  "wss" : "ws"}://${location.host}/ws` ``. No hardcoded host/port, works in dev
  (via Vite proxy, below) and prod identically, and rides the proxy's TLS.

### 3.2 Persistence — SQLite behind a storage interface

Use Bun's built-in **`bun:sqlite`** — it ships with the runtime (no new
dependency), is synchronous and fast, and fits the "one container" goal. We
wrap it in a small storage interface so:
1. the current JSON behavior can be ported incrementally,
2. a future Postgres backend is a new implementation, not a rewrite.

```ts
// backend/storage/Storage.ts (shape, not final)
export interface Storage {
  // boards
  createBoard(input: { name: string; passphrase: string }): Promise<BoardMeta>;
  listBoards(): Promise<BoardMeta[]>;
  getBoard(id: string): Promise<BoardMeta | null>;
  verifyPassphrase(id: string, passphrase: string): Promise<boolean>;
  deleteBoard(id: string): Promise<void>;

  // canvas objects (scoped to a board)
  getObjects(boardId: string): Promise<Types.Object[]>;
  upsertObject(boardId: string, obj: Types.Object): Promise<void>;
  deleteObject(boardId: string, objectId: string): Promise<void>;

  // future: getNotes(boardId), upsertNote(...), etc. — additive
}
```

`SqliteStorage` implements it with `bun:sqlite`. A thin **migration runner**
(sequential `.sql` files + a `schema_version` table) runs on startup so
upgrades are automatic for self-hosters.

> **Why per-object rows, not a JSON blob per board?** It matches the existing
> per-object `addItem`/`alterItem` write pattern (one mutation = one row
> upsert) instead of rewriting the whole board on every drag, and it scales to
> big boards. Each row stores the `Object` as a JSON column keyed by
> `(board_id, id)`.

#### Schema v1

```sql
CREATE TABLE boards (
  id             TEXT PRIMARY KEY,        -- nanoid; also the join-link token
  name           TEXT NOT NULL,
  passphrase_hash TEXT NOT NULL,          -- hashed, never stored plaintext
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE objects (
  board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  id         TEXT NOT NULL,               -- the Object.id
  type       TEXT NOT NULL,               -- image | text | svg (denormalized for queries)
  data       TEXT NOT NULL,               -- JSON.stringify(Object)
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (board_id, id)
);
CREATE INDEX idx_objects_board ON objects(board_id);

CREATE TABLE schema_version (version INTEGER NOT NULL);
```

> **Future content** (the reason for the abstraction) slots in as *new tables*
> that also reference `boards(id)` — e.g. `board_notes(board_id, id, body, …)` —
> plus new packet types and new `Storage` methods. Rooms, auth, and the canvas
> code don't change when we add them.

**Passphrase hashing:** `Bun.password.hash` / `Bun.password.verify` (argon2/bcrypt
built in). The passphrase is shared out-of-band by the admin; the *link* (board
id) is not a secret, the passphrase is.

### 3.3 The board / room model on the backend

`server.ts` grows from "one global board" to "a map of rooms":

- **In-memory cache per *active* board.** When the first client joins board `X`,
  lazy-load its objects from SQLite into an in-memory map and register the
  socket under that room. Mutations update the in-memory map (for fast
  broadcast) **and** write through to SQLite (durability). When the last client
  leaves, the cache for `X` can be dropped.
- **Broadcasts are room-scoped.** `getSiblingSockets` becomes "other sockets
  *in the same board*", not "all sockets". This is the core multi-board change.
- **Socket → board binding.** One socket belongs to exactly one board (set at
  join). A user with two boards open = two tabs = two sockets/clients. This keeps
  routing trivial and means packets after `join` don't need to carry `boardId`
  (the server already knows the socket's room).

### 3.4 Join flow with passphrase

```
client                                  server
  │  open WS /ws                           │
  │ ───────────────────────────────────▶   │
  │  { type:"join", boardId, passphrase,    │
  │    name: <username>, identity }         │
  │ ───────────────────────────────────▶   │  verifyPassphrase(boardId, passphrase)
  │                                         │   ├─ ok  → bind socket to room,
  │  { type:"joinResponse", payload:{       │   │         load board, reply with objects
  │      boardInformation } }               │ ◀─┘
  │ ◀───────────────────────────────────    │
  │   — OR —                                │
  │  { type:"joinError", reason }           │   ├─ bad passphrase / no such board
  │ ◀───────────────────────────────────    │
```

`identity` stays the per-connection `nanoid`; `name` is the per-board username.
We may also broadcast lightweight presence (`who's here`) later — out of scope
for v1 but the username makes it cheap.

### 3.5 Admin: creating boards

No user accounts, so admin access is a single **shared secret** from the
environment (`BARNABUS_ADMIN_SECRET`). Minimal surface:

- `POST /api/admin/boards`   `{ name, passphrase }`  → creates a board, returns
  `{ id, joinUrl }`. Requires `Authorization: Bearer <ADMIN_SECRET>`.
- `GET  /api/admin/boards`   → list boards (names, ids, created_at; **not**
  passphrases — we only store hashes).
- `DELETE /api/admin/boards/:id` → delete a board (cascades objects).
- A tiny **`/admin` page** (served static, or a route in the SPA) that prompts
  for the secret and gives a form to create/list/delete boards and copy each
  board's join link.

Public, non-secret helper for the join screen:
- `GET /api/boards/:id` → `{ id, name }` (so the join form can show "You're
  joining **Tom's Dungeon**" before the passphrase is entered). Returns 404 if no
  such board. Never leaks the hash.

### 3.6 Frontend changes

**Bring back a real entry screen** (revive/replace `Landing.svelte`, wire it
into `Container.svelte`, which currently hardcodes `<App/>`):

1. **Board picker** — lists boards the user has joined (from localStorage), each
   a one-click reconnect. Plus "Join a board" (paste link or id + passphrase +
   username) and, behind the admin secret, an entry to the admin page.
2. **Membership store** (`localStorage`): `barnabus.joinedBoards = [{ boardId,
   name, passphrase, username }]`. New `.svelte.ts` module, e.g.
   `membership.svelte.ts`, with `$state` + load/save. A join link like
   `https://host/?board=<boardId>` just pre-fills the join form (passphrase
   still required).
   > **Security note to document:** the passphrase is stored in plaintext in
   > localStorage. For this threat model (self-hosted, low-stakes table) that's
   > acceptable and is the price of "remember my boards", but we call it out in
   > the README so nobody is surprised.
3. **`ConnectionManager` updates:** connect to same-origin `/ws`; send `boardId`
   + `passphrase` + `name` in `join`; handle `joinError` (bad passphrase → toast +
   back to picker); on `joinResponse`, **clear existing DOM objects** then
   `importObjects(...)`. Switching boards = disconnect, clear, reconnect.
4. **App shows current board** (name in a corner, a "leave / switch board"
   affordance).

### 3.7 Wire protocol changes (`/types.ts`)

Per `CLAUDE.md`, edit `types.ts` first; both ends follow.

- `Packet_Join.payload` gains `boardId: string`, `passphrase: string`, and the
  username (`identity.name` is already optional — use it, or add an explicit
  `name`). 
- Add `Packet_JoinError = { type: "joinError"; identity; reason: string }`.
- `joinResponse` payload stays "the board's objects" but is now *that board's*
  set. Consider typing `boardInformation` properly (it's `any` today) as
  `Record<string, Object>` while we're in here.
- After join, `addItem`/`alterItem`/`diceRoll` are unchanged on the wire — the
  server routes them by the socket's bound room.

---

## 4. Keeping a good dev environment

The single-container/single-port prod shape must **not** force us to rebuild the
frontend to see a change. Strategy: **same code path in dev and prod via a Vite
proxy**, plus a prod-like compose for when we want to test the real artifact.

### 4.1 Inner loop (daily dev) — unchanged speed
- `cd backend && bun run dev` → backend with `bun --watch` on `PORT` (HTTP + `/ws`).
- `cd frontend && bun run dev` → Vite HMR on `:3000`.
- **Add a Vite proxy** so the frontend always talks to same-origin paths in both
  dev and prod (no `if (dev)` branching in app code):

```ts
// frontend/vite.config.ts
server: {
  port: 3000,
  proxy: {
    "/api": "http://localhost:8080",
    "/ws":  { target: "ws://localhost:8080", ws: true },
  },
}
```

So `ConnectionManager` connects to `/ws` and `/api/...` everywhere; in dev Vite
forwards them to the backend, in prod the backend serves them directly. One code
path, full HMR.

### 4.2 Prod-like loop (test the real container)
- **`docker compose up`** builds the image and runs it with a named volume for
  `/data`. Use this to verify the built static frontend, the single port, and
  SQLite persistence across restarts — the things the inner loop doesn't exercise.

```yaml
# docker-compose.yml (sketch)
services:
  barnabus:
    build: .
    ports: ["8080:8080"]
    environment:
      PORT: "8080"
      BARNABUS_ADMIN_SECRET: "change-me"
      DB_PATH: "/data/barnabus.db"
    volumes:
      - barnabus-data:/data
volumes:
  barnabus-data:
```

### 4.3 The image — multi-stage Dockerfile
The current `backend/Dockerfile` only builds the backend. Replace with a
repo-root multi-stage build that bundles both:

```dockerfile
# 1) build frontend
FROM oven/bun:1 AS web
WORKDIR /web
COPY frontend/package.json frontend/bun.lockb ./frontend/
COPY types.ts ./types.ts
RUN cd frontend && bun install
COPY frontend ./frontend
RUN cd frontend && bun run build        # -> frontend/dist

# 2) runtime: backend + serve built frontend
FROM oven/bun:1 AS app
WORKDIR /app
COPY backend/package.json backend/bun.lock ./backend/
COPY types.ts ./types.ts
RUN cd backend && bun install
COPY backend ./backend
COPY --from=web /web/frontend/dist ./frontend/dist   # static assets the server serves
ENV PORT=8080 DB_PATH=/data/barnabus.db
EXPOSE 8080
VOLUME ["/data"]
CMD ["bun", "run", "backend/server.ts"]
```

Notes: the build must keep the shared `types.ts` import path (`../types`) intact
in both stages; the runtime serves `frontend/dist` via `express.static` (or
`Bun.serve` `fetch`). `bun:sqlite` needs no system packages. (Pin a Bun version
tag rather than `latest` for reproducibility.)

### 4.4 Config surface (env vars)
| Var | Purpose | Default |
|---|---|---|
| `PORT` | single HTTP+WS port | `8080` |
| `DB_PATH` | SQLite file path (on the volume) | `/data/barnabus.db` |
| `BARNABUS_ADMIN_SECRET` | admin bearer secret | *(required to use admin)* |

### 4.5 Migrating existing data
One-time script: read `backend/data/board.json`, create a "Default Board" (with a
passphrase the operator chooses), insert each object as a row under that board.
Run it via a `bun run migrate:json` script so nobody loses the current board.

---

## 5. Phased build order

Each phase is independently shippable and leaves `bun run check` green.

- **Phase 0 — Plumbing, no behavior change.**
  Storage interface + `SqliteStorage` (`bun:sqlite`) + migration runner; port
  consolidation (`ws` on the shared HTTP server, serve static `dist`); Vite
  proxy; JSON→SQLite import script. Result: *same single-board app*, now SQLite-
  backed, single port, container-buildable. Highest-leverage, lowest-risk.

- **Phase 1 — Board abstraction (server).**
  `boards` table; `board_id` on objects; per-board in-memory cache; room-scoped
  broadcasts. The migrated board becomes the default room. Still no auth UI yet
  (join can default to that one board) so we can verify rooms in isolation.

- **Phase 2 — Passphrase + admin.**
  Passphrase hashing/verify; `join` gating + `joinError`; admin HTTP API +
  `BARNABUS_ADMIN_SECRET`; `GET /api/boards/:id` lookup. Protocol changes in
  `types.ts` land here.

- **Phase 3 — Frontend board UX.**
  Revive landing/board-picker; `membership.svelte.ts` localStorage store; join
  form + link prefill; `ConnectionManager` same-origin `/ws` + join payload +
  board-switch (clear DOM → import); current-board UI. Re-enable
  `Container.svelte`'s conditional render.

- **Phase 4 — Packaging & docs.**
  Multi-stage Dockerfile at repo root; `docker-compose.yml`; volume; env config;
  HTTP healthcheck; self-hoster README (run it, put a reverse proxy in front for
  TLS, create boards, share link+passphrase, backup = copy the SQLite file).

- **Phase 5 — (future) extensible board content.**
  The payoff for the abstraction: add the first non-canvas content type (text
  snippets/notes attached to a board) as a new table + packet types + `Storage`
  methods, touching neither rooms nor auth.

---

## 6. Open questions to resolve before/while building
1. **Admin model:** single shared `BARNABUS_ADMIN_SECRET` (proposed) vs. a tiny
   admin-accounts table? Shared secret is far simpler for self-host; confirm
   it's enough.
2. **Board switching UX:** one board per tab (proposed, simplest) vs. in-app
   switcher that reuses the socket? One-per-tab avoids socket/room churn.
3. **Presence:** do we want a live "who's on this board" list now (we have the
   username) or defer? Cheap to add, easy to defer.
4. **Passphrase in localStorage:** accept the plaintext-convenience tradeoff
   (proposed) or require re-entry each session? Proposed = remember it.
5. **Keep Express or move to `Bun.serve`?** Proposed: keep Express for the
   smallest first diff; reconsider once single-port is in.
6. **Object delete on the wire:** there's currently no explicit "remove object"
   packet (deletes happen locally). Multi-client correctness for deletes may
   need a `removeItem` packet — worth confirming current behavior during Phase 1.
