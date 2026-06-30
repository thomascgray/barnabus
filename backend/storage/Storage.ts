// Storage abstraction. Phase 0 only needs board-scoped object persistence; the
// board CRUD / passphrase methods arrive in Phase 1/2. Two implementations:
// JsonStorage (the legacy board.json behavior) and SqliteStorage.
//
// Kept synchronous on purpose: both fs and bun:sqlite are synchronous here, and
// the relay's call sites are synchronous. A future async backend (e.g. Postgres)
// would widen these to return Promises.
import type * as Types from "../../types";

// Phase 0 runs a single implicit board until the real board abstraction lands.
export const DEFAULT_BOARD_ID = "default";

// Board metadata as exposed to the relay/admin API. The passphrase hash is
// deliberately NOT part of this shape — it never leaves the storage layer.
export interface BoardMeta {
  id: string;
  name: string;
  // Display name of the admin who created the board (free text supplied at
  // create time). Shown on the join/invite screen ("…invited by <createdBy>").
  // Empty for the built-in example board and any pre-existing rows.
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  // Whether the board is passphrase-gated. Derived from the (never-exposed)
  // passphrase hash so clients can skip the passphrase prompt for open boards.
  hasPassphrase: boolean;
}

export interface Storage {
  /** Make sure a board row exists (no-op if it already does). Stays open (no
   *  passphrase) — used for the implicit default board. */
  ensureBoard(boardId: string, name?: string): void;

  // --- boards (Phase 2) -----------------------------------------------------
  /** Create a new board with a generated id and (optionally) a passphrase and
   *  the name of the admin who created it. */
  createBoard(input: { name: string; passphrase: string; createdBy?: string }): BoardMeta;
  /** All boards, newest first. Never includes passphrase hashes. */
  listBoards(): BoardMeta[];
  /** A single board's metadata, or null if it doesn't exist. */
  getBoard(boardId: string): BoardMeta | null;
  /** True if the board exists and the passphrase matches (open boards — those
   *  with no passphrase — accept any/empty passphrase). */
  verifyPassphrase(boardId: string, passphrase: string): boolean;
  /** Delete a board and (via FK cascade) all its objects. */
  deleteBoard(boardId: string): void;

  // --- canvas objects (scoped to a board) -----------------------------------
  /** All objects on a board. */
  getObjects(boardId: string): Types.Object[];
  /** Insert or replace a single object. */
  upsertObject(boardId: string, object: Types.Object): void;
  /** Remove a single object (used by the Phase 1 removeItem packet). */
  deleteObject(boardId: string, objectId: string): void;
}
