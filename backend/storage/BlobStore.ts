// Binary blob storage for uploaded images. Kept separate from the SQLite
// `Storage` (which only ever holds the image URL inside Object_Image.src) so
// blobs stay out of the DB — small DB, trivial HTTP caching, and an S3/R2
// backend is a later swap of this interface.
//
// Files are content-addressed (sha256) and board-scoped:
//   <uploadsDir>/<boardId>/<sha256>.webp
// so deleting a board is just removing its directory.
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export interface PutResult {
  url: string;
  hash: string;
}

export interface BlobStore {
  /** Store bytes for a board, returning a same-origin URL. Idempotent: an
   *  identical image (same hash) is written once and reused. */
  put(boardId: string, bytes: Buffer): PutResult;
  /** Remove all of a board's blobs (used when a board is deleted). */
  deleteBoard(boardId: string): void;
}

// Only allow board ids that are safe as a single path segment, so a crafted
// boardId can never escape the uploads root.
const safeSegment = (s: string): string => s.replace(/[^a-zA-Z0-9_-]/g, "");

export class FsBlobStore implements BlobStore {
  constructor(private root: string) {
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
  }

  put(boardId: string, bytes: Buffer): PutResult {
    const board = safeSegment(boardId);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const dir = path.join(this.root, board);
    const file = path.join(dir, `${hash}.webp`);

    if (!fs.existsSync(file)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, bytes);
    }

    return { url: `/uploads/${board}/${hash}.webp`, hash };
  }

  deleteBoard(boardId: string): void {
    const dir = path.join(this.root, safeSegment(boardId));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
