// SQLite-backed storage via Bun's built-in bun:sqlite. Each object is one row
// keyed by (board_id, id), with the full Object serialized as JSON in `data`.
import { Database } from "bun:sqlite";
import * as fs from "fs";
import * as path from "path";
import type * as Types from "../../types";
import type { BoardMeta, Storage } from "./Storage";
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

  ensureBoard(boardId: string, name = "Example Board"): void {
    const now = Date.now();
    this.db
      .query(
        `INSERT INTO boards (id, name, passphrase_hash, created_at, updated_at)
         VALUES (?, ?, '', ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .run(boardId, name, now, now);
  }

  createBoard(input: { name: string; passphrase: string; createdBy?: string }): BoardMeta {
    const id = crypto.randomUUID();
    const now = Date.now();
    // Empty passphrase => open board (verifyPassphrase short-circuits to true).
    const hash = input.passphrase ? Bun.password.hashSync(input.passphrase) : "";
    const createdBy = input.createdBy ?? "";
    this.db
      .query(
        `INSERT INTO boards (id, name, passphrase_hash, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.name, hash, createdBy, now, now);
    return { id, name: input.name, createdBy, createdAt: now, updatedAt: now, hasPassphrase: hash !== "" };
  }

  listBoards(): BoardMeta[] {
    return this.db
      .query<
        { id: string; name: string; created_by: string; created_at: number; updated_at: number; passphrase_hash: string },
        []
      >(`SELECT id, name, created_by, created_at, updated_at, passphrase_hash FROM boards ORDER BY created_at DESC`)
      .all()
      .map((r) => ({
        id: r.id,
        name: r.name,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        hasPassphrase: r.passphrase_hash !== "",
      }));
  }

  getBoard(boardId: string): BoardMeta | null {
    const r = this.db
      .query<
        { id: string; name: string; created_by: string; created_at: number; updated_at: number; passphrase_hash: string },
        [string]
      >(`SELECT id, name, created_by, created_at, updated_at, passphrase_hash FROM boards WHERE id = ?`)
      .get(boardId);
    return r
      ? {
          id: r.id,
          name: r.name,
          createdBy: r.created_by,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          hasPassphrase: r.passphrase_hash !== "",
        }
      : null;
  }

  verifyPassphrase(boardId: string, passphrase: string): boolean {
    const r = this.db
      .query<{ passphrase_hash: string }, [string]>(
        `SELECT passphrase_hash FROM boards WHERE id = ?`
      )
      .get(boardId);
    if (!r) return false; // no such board
    if (r.passphrase_hash === "") return true; // open board
    return Bun.password.verifySync(passphrase ?? "", r.passphrase_hash);
  }

  deleteBoard(boardId: string): void {
    // Objects cascade via the FK (PRAGMA foreign_keys = ON in the constructor).
    this.db.query(`DELETE FROM boards WHERE id = ?`).run(boardId);
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
