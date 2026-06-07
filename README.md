# Barnabus VTT

A whiteboard-like **virtual tabletop** for the web, designed to be self-hosted.
Multiple people connect to a shared board over WebSockets and collaboratively
place/move/draw objects (images, text, freehand SVG) on an infinite pan-and-zoom
canvas, and roll dice — all in real time.

- **One container, one port.** HTTP, the WebSocket relay, image uploads, and the
  built frontend are all served from a single port.
- **No accounts.** The admin creates boards; each board has a shareable link and
  a passphrase. Players join with a display name of their choosing.
- **Your data stays yours.** Boards live in a SQLite file and uploaded images on
  disk, both under one `/data` volume. Backup = copy that volume.

---

## Quick start (Docker)

The fastest way to run a real instance:

```bash
git clone https://github.com/thomascgray/barnabus.git
cd barnabus

# Set a strong admin secret first — admin is disabled until you do.
BARNABUS_ADMIN_SECRET="$(openssl rand -hex 24)"   # note this down

docker compose up --build -d
```

This serves the whole app on **`http://localhost:8080`**. Open it, click
**Admin**, paste your secret, and create your first board.

> Edit `docker-compose.yml` to set `BARNABUS_ADMIN_SECRET` permanently (it
> defaults to `change-me` — change it). Data persists in the `barnabus-data`
> named volume across `down`/`up`.

### Or with plain `docker run`

```bash
docker build -t barnabus .
docker run -d --name barnabus \
  -p 8080:8080 \
  -e BARNABUS_ADMIN_SECRET="your-strong-secret" \
  -v barnabus-data:/data \
  barnabus
```

---

## Putting it on the internet (HTTPS)

The container speaks **plain HTTP/WS** — it does **not** terminate TLS. Put a
reverse proxy in front of it for HTTPS; the frontend uses same-origin paths and
auto-selects `wss://` when served over HTTPS, so WebSockets "just work" through
the proxy.

**Caddy** (simplest — automatic Let's Encrypt certificates):

```caddy
vtt.example.com {
    reverse_proxy localhost:8080
}
```

**nginx** — proxy `/` to `localhost:8080` and make sure you forward the
WebSocket upgrade headers:

```nginx
location / {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host       $host;
}
```

That's the whole deployment: container on `8080`, proxy in front for TLS, a
domain pointed at the proxy.

---

## Using it

### As the admin — create boards
1. Open the app, click **Admin** (bottom of the landing screen).
2. Enter your `BARNABUS_ADMIN_SECRET`.
3. Create a board with a **name** and a **passphrase**. You'll get a **join
   link** (`https://your-host/?board=<id>`).
4. Hand the **link + passphrase** to your players (out-of-band — the link is not
   a secret, the passphrase is).

You can also drive the admin API directly:

```bash
# Create a board
curl -X POST https://your-host/api/admin/boards \
  -H "Authorization: Bearer $BARNABUS_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name":"Tom'\''s Dungeon","passphrase":"red-dragon"}'

curl https://your-host/api/admin/boards \
  -H "Authorization: Bearer $BARNABUS_ADMIN_SECRET"          # list

curl -X DELETE https://your-host/api/admin/boards/<id> \
  -H "Authorization: Bearer $BARNABUS_ADMIN_SECRET"          # delete (cascades objects + images)
```

### As a player — join a board
Open the join link an admin shared with you. The invite screen shows which
board you're joining and who made it; enter the board's **passphrase** (if any)
and a **username**, and join. Your browser remembers boards you've joined for
one-click reconnect. (No link handy? Paste it into "Have an invite link?" on the
dashboard.)

> There is also a built-in open **Example Board** (no passphrase), seeded with a
> little welcome content to show how the app works.

---

## Configuration

All config is environment-driven:

| Var | Purpose | Default |
|---|---|---|
| `PORT` | single HTTP + WebSocket port | `8080` |
| `DB_PATH` | SQLite database file | `/data/barnabus.db` (container) |
| `UPLOADS_DIR` | uploaded-image storage dir | `/data/uploads` (container) |
| `MAX_UPLOAD_MB` | max accepted image upload size | `25` |
| `BARNABUS_ADMIN_SECRET` | admin bearer secret | *(empty — admin disabled until set)* |

When `BARNABUS_ADMIN_SECRET` is empty the admin routes return `503 admin not
configured`, so **set it** before you expect to create boards.

---

## Data & backups

Everything durable lives under the single **`/data`** volume:

```
/data
├── barnabus.db        # boards + canvas objects (SQLite)
└── uploads/<boardId>/ # uploaded images (content-addressed .webp files)
```

To back up, snapshot/copy the whole volume while or after the container runs
(SQLite is fine to copy at rest). To restore, drop the files back and start the
container. Deleting a board removes its objects (FK cascade) and its uploads dir.

---

## Local development

You do **not** need Docker for day-to-day work. Install [Bun](https://bun.sh),
then from the repo root:

```bash
bun install          # root dev tooling (concurrently)
bun run dev          # boots frontend (Vite HMR :3000) + backend (bun --watch :8080)
```

Open **http://localhost:3000** — Vite proxies `/ws`, `/api`, `/uploads` to the
backend, so app code uses identical same-origin paths in dev and prod. Local
data lands in `./data/` (gitignored); `rm -rf data` resets to a clean slate.

- `bun run check` — type-check both packages (the CI gate).
- `docker compose up --build` — verify the packaged container (outer loop, not
  daily dev).

See [`CLAUDE.md`](CLAUDE.md) for the architecture and [`docs/self-hosting-plan.md`](docs/self-hosting-plan.md)
for the build plan.

---

## Security notes (read before exposing it)

- **Set a strong `BARNABUS_ADMIN_SECRET`.** It's the only thing gating board
  creation/deletion. Anyone with it is the admin.
- **Passphrases are remembered in the browser** (localStorage, plaintext) so you
  can hop between boards in one click. This is an accepted tradeoff for a
  low-stakes, self-hosted table — don't reuse a sensitive passphrase.
- **Images are public capability URLs.** An uploaded image is served at an
  unguessable content-hash URL with no per-request auth; anyone with the URL can
  fetch it. Don't upload anything you'd consider private.
- **The container has no TLS.** Always run it behind a reverse proxy on the
  public internet (see above).
