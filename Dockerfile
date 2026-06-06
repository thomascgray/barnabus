# syntax=docker/dockerfile:1
# Multi-stage build: compile the frontend, then run the backend serving both the
# API/WebSocket and the built static frontend on a single port.

# 1) Build the frontend ------------------------------------------------------
FROM oven/bun:1-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/bun.lockb ./frontend/
RUN cd frontend && bun install --frozen-lockfile
# The shared wire protocol is imported as ../../types from frontend/src.
COPY types.ts ./types.ts
COPY frontend ./frontend
RUN cd frontend && bun run build   # -> /web/frontend/dist

# 2) Runtime: backend + static frontend --------------------------------------
FROM oven/bun:1-alpine AS app
WORKDIR /app
COPY backend/package.json backend/bun.lock ./backend/
RUN cd backend && bun install --frozen-lockfile
# Backend imports ../types; config resolves static dir to ../frontend/dist.
COPY types.ts ./types.ts
COPY backend ./backend
COPY --from=web /web/frontend/dist ./frontend/dist

ENV PORT=8080 \
    DB_PATH=/data/barnabus.db \
    UPLOADS_DIR=/data/uploads \
    NODE_ENV=production

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "backend/server.ts"]
