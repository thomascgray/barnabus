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

  // Where uploaded images will live (reserved for Phase 4; unused in Phase 0).
  uploadsDir: str(process.env.UPLOADS_DIR, path.join(process.cwd(), "data", "uploads")),

  // Built frontend to serve in production. In dev this dir won't exist and Vite
  // serves the app instead (with a proxy to this backend).
  staticDir: str(process.env.STATIC_DIR, path.join(import.meta.dir, "..", "frontend", "dist")),
};
