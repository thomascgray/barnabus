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

export interface Storage {
  /** Make sure a board row exists (no-op if it already does). */
  ensureBoard(boardId: string, name?: string): void;
  /** All objects on a board. */
  getObjects(boardId: string): Types.Object[];
  /** Insert or replace a single object. */
  upsertObject(boardId: string, object: Types.Object): void;
  /** Remove a single object (used by the Phase 1 removeItem packet). */
  deleteObject(boardId: string, objectId: string): void;
}
