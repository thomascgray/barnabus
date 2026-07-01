// SQLite-backed storage via Bun's built-in bun:sqlite. Each object is one row
// keyed by (board_id, id), with the full Object serialized as JSON in `data`.
import { Database } from "bun:sqlite";
import * as fs from "fs";
import * as path from "path";
import type * as Types from "../../types";
import type { BoardMeta, CanvasMeta, Storage } from "./Storage";
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
    // Every board starts with one (undeletable) canvas.
    this.ensureDefaultCanvas(id);
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

  // --- canvases (issue #26) -------------------------------------------------

  private rowToCanvas(r: {
    id: string;
    board_id: string;
    name: string;
    position: number;
    created_at: number;
    updated_at: number;
  }): CanvasMeta {
    return {
      id: r.id,
      boardId: r.board_id,
      name: r.name,
      position: r.position,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  ensureDefaultCanvas(boardId: string, name = "Board 1"): CanvasMeta {
    const existing = this.listCanvases(boardId);
    if (existing.length > 0) return existing[0];
    const now = Date.now();
    this.db
      .query(
        `INSERT INTO canvases (board_id, id, name, position, created_at, updated_at)
         VALUES (?, 'default', ?, 0, ?, ?)
         ON CONFLICT(board_id, id) DO NOTHING`
      )
      .run(boardId, name, now, now);
    return this.getCanvas(boardId, "default")!;
  }

  listCanvases(boardId: string): CanvasMeta[] {
    return this.db
      .query<
        { id: string; board_id: string; name: string; position: number; created_at: number; updated_at: number },
        [string]
      >(
        `SELECT id, board_id, name, position, created_at, updated_at
         FROM canvases WHERE board_id = ? ORDER BY position ASC, created_at ASC`
      )
      .all(boardId)
      .map((r) => this.rowToCanvas(r));
  }

  getCanvas(boardId: string, canvasId: string): CanvasMeta | null {
    const r = this.db
      .query<
        { id: string; board_id: string; name: string; position: number; created_at: number; updated_at: number },
        [string, string]
      >(
        `SELECT id, board_id, name, position, created_at, updated_at
         FROM canvases WHERE board_id = ? AND id = ?`
      )
      .get(boardId, canvasId);
    return r ? this.rowToCanvas(r) : null;
  }

  createCanvas(boardId: string, input: { id: string; name: string }): CanvasMeta {
    const now = Date.now();
    // Append after the current last canvas so display order = creation order.
    const posRow = this.db
      .query<{ p: number | null }, [string]>(
        `SELECT MAX(position) AS p FROM canvases WHERE board_id = ?`
      )
      .get(boardId);
    const position = (posRow?.p ?? -1) + 1;
    this.db
      .query(
        `INSERT INTO canvases (board_id, id, name, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(boardId, input.id, input.name, position, now, now);
    return { id: input.id, boardId, name: input.name, position, createdAt: now, updatedAt: now };
  }

  renameCanvas(boardId: string, canvasId: string, name: string): CanvasMeta | null {
    const now = Date.now();
    this.db
      .query(`UPDATE canvases SET name = ?, updated_at = ? WHERE board_id = ? AND id = ?`)
      .run(name, now, boardId, canvasId);
    return this.getCanvas(boardId, canvasId);
  }

  deleteCanvas(boardId: string, canvasId: string): void {
    // No FK from objects → canvases (SQLite can't add one via ALTER), so remove
    // the canvas's objects explicitly, then the canvas row.
    this.db.query(`DELETE FROM objects WHERE board_id = ? AND canvas_id = ?`).run(boardId, canvasId);
    this.db.query(`DELETE FROM canvases WHERE board_id = ? AND id = ?`).run(boardId, canvasId);
  }

  getObjects(boardId: string, canvasId: string): Types.Object[] {
    const rows = this.db
      .query<{ data: string }, [string, string]>(
        `SELECT data FROM objects WHERE board_id = ? AND canvas_id = ?`
      )
      .all(boardId, canvasId);
    return rows.map((row) => JSON.parse(row.data) as Types.Object);
  }

  upsertObject(boardId: string, canvasId: string, object: Types.Object): void {
    const now = Date.now();
    this.db
      .query(
        `INSERT INTO objects (board_id, canvas_id, id, type, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(board_id, id) DO UPDATE SET
           canvas_id = excluded.canvas_id,
           type = excluded.type,
           data = excluded.data,
           updated_at = excluded.updated_at`
      )
      .run(boardId, canvasId, object.id, object.type, JSON.stringify(object), now);
  }

  deleteObject(boardId: string, canvasId: string, objectId: string): void {
    this.db
      .query(`DELETE FROM objects WHERE board_id = ? AND canvas_id = ? AND id = ?`)
      .run(boardId, canvasId, objectId);
  }
}
