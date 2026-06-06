// Centralized, env-driven backend configuration.
// Defaults reproduce the historical local-dev behavior (cwd-relative ./data).
import * as path from "path";

const num = (v: string | undefined, fallback: number): number =>
  v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : fallback;

const str = (v: string | undefined, fallback: string): string =>
  v !== undefined && v !== "" ? v : fallback;

export const config = {
  // Single HTTP + WebSocket port (was split 5000/8080).
  port: num(process.env.PORT, 8080),

  // SQLite database file. In the container this is set to /data/barnabus.db.
  dbPath: str(process.env.DB_PATH, path.join(process.cwd(), "data", "barnabus.db")),

  // Where uploaded images live (content-addressed, board-scoped).
  uploadsDir: str(process.env.UPLOADS_DIR, path.join(process.cwd(), "data", "uploads")),

  // Max accepted image upload size, in megabytes.
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 25),

  // Built frontend to serve in production. In dev this dir won't exist and Vite
  // serves the app instead (with a proxy to this backend).
  staticDir: str(process.env.STATIC_DIR, path.join(import.meta.dir, "..", "frontend", "dist")),

  // Shared secret gating the admin API (board create/list/delete). When empty,
  // the admin routes refuse all requests (admin is "not configured"). A real
  // admin-accounts table can later replace the check in requireAdmin().
  adminSecret: str(process.env.BARNABUS_ADMIN_SECRET, ""),
};
