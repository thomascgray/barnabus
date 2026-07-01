// Tiny forward-only migration runner. Migrations are inlined (rather than loaded
// from .sql files) so they travel with the bundle regardless of how the backend
// is run. Each runs once, in order, inside a transaction; applied versions are
// recorded in schema_version.
import type { Database } from "bun:sqlite";

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS boards (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        passphrase_hash TEXT NOT NULL DEFAULT '',
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS objects (
        board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        id         TEXT NOT NULL,
        type       TEXT NOT NULL,
        data       TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (board_id, id)
      );

      CREATE INDEX IF NOT EXISTS idx_objects_board ON objects(board_id);
    `,
  },
  {
    // The display name of the admin who created a board, shown on the join
    // screen. Existing rows (and the built-in example board) default to ''.
    // Also rebrand the built-in "default" board as the "Example Board" (only
    // if it still has the old auto-seeded name, so a renamed board is left be).
    version: 2,
    sql: `
      ALTER TABLE boards ADD COLUMN created_by TEXT NOT NULL DEFAULT '';

      UPDATE boards SET name = 'Example Board'
      WHERE id = 'default' AND name = 'Default Board';
    `,
  },
  {
    // Multiple canvases per board/room (issue #26). Each board now holds many
    // canvases and every object belongs to one. We add a `canvases` table and a
    // `canvas_id` column on objects, then back-fill: give every existing board a
    // single default canvas (id 'default') and assign all its existing objects
    // to it (the ADD COLUMN default). The 'default' id is only a back-fill /
    // ensureDefaultCanvas convenience — "the first canvas" is decided by
    // ordering (position, created_at), not by this magic id.
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS canvases (
        board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        id         TEXT NOT NULL,
        name       TEXT NOT NULL,
        position   INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (board_id, id)
      );

      CREATE INDEX IF NOT EXISTS idx_canvases_board ON canvases(board_id);

      ALTER TABLE objects ADD COLUMN canvas_id TEXT NOT NULL DEFAULT 'default';

      CREATE INDEX IF NOT EXISTS idx_objects_canvas ON objects(board_id, canvas_id);

      INSERT INTO canvases (board_id, id, name, position, created_at, updated_at)
        SELECT id, 'default', 'Board 1', 0, created_at, updated_at FROM boards;
    `,
  },
];

export function runMigrations(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);`);
  const row = db.query<{ v: number | null }, []>(
    `SELECT MAX(version) AS v FROM schema_version`
  ).get();
  const current = row?.v ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > current) {
      db.transaction(() => {
        db.exec(migration.sql);
        db.query(`INSERT INTO schema_version (version) VALUES (?)`).run(migration.version);
      })();
      console.log(`applied migration v${migration.version}`);
    }
  }
}
