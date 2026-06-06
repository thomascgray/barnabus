// SQLite-backed storage via Bun's built-in bun:sqlite. Each object is one row
// keyed by (board_id, id), with the full Object serialized as JSON in `data`.
import { Database } from "bun:sqlite";
import * as fs from "fs";
import * as path from "path";
import type * as Types from "../../types";
import type { Storage } from "./Storage";
import { runMigrations } from "./migrations";

export class SqliteStorage implements Storage {
  private db: Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    runMigrations(this.db);
  }

  ensureBoard(boardId: string, name = "Default Board"): void {
    const now = Date.now();
    this.db
      .query(
        `INSERT INTO boards (id, name, passphrase_hash, created_at, updated_at)
         VALUES (?, ?, '', ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .run(boardId, name, now, now);
  }

  getObjects(boardId: string): Types.Object[] {
    const rows = this.db
      .query<{ data: string }, [string]>(`SELECT data FROM objects WHERE board_id = ?`)
      .all(boardId);
    return rows.map((row) => JSON.parse(row.data) as Types.Object);
  }

  upsertObject(boardId: string, object: Types.Object): void {
    const now = Date.now();
    this.db
      .query(
        `INSERT INTO objects (board_id, id, type, data, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(board_id, id) DO UPDATE SET
           type = excluded.type,
           data = excluded.data,
           updated_at = excluded.updated_at`
      )
      .run(boardId, object.id, object.type, JSON.stringify(object), now);
  }

  deleteObject(boardId: string, objectId: string): void {
    this.db
      .query(`DELETE FROM objects WHERE board_id = ? AND id = ?`)
      .run(boardId, objectId);
  }
}
