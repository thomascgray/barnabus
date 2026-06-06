// Legacy persistence: a single board kept as a flat { [objectId]: Object } map in
// backend/data/board.json, rewritten on every mutation. This implementation
// preserves the exact on-disk format so swapping it in is a pure refactor with
// no behavior change. It is single-board: the boardId argument is ignored.
import * as fs from "fs";
import * as path from "path";
import type * as Types from "../../types";
import type { Storage } from "./Storage";

export class JsonStorage implements Storage {
  private board: { [id: string]: Types.Object } = {};

  constructor(private filePath: string) {
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      this.board = {};
      return;
    }
    try {
      this.board = JSON.parse(fs.readFileSync(this.filePath).toString());
    } catch (error) {
      console.error("Error reading board state:", error);
      this.board = {};
    }
  }

  private persist(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.board, null, 2));
  }

  ensureBoard(): void {
    // Single-board JSON file: nothing to create.
  }

  getObjects(): Types.Object[] {
    return Object.values(this.board);
  }

  upsertObject(_boardId: string, object: Types.Object): void {
    this.board[object.id] = object;
    this.persist();
  }

  deleteObject(_boardId: string, objectId: string): void {
    delete this.board[objectId];
    this.persist();
  }
}
