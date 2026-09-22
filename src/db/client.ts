import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Opens (and if necessary, initializes) the SQLite database for the Vertical Slice.
 * Uses Node's built-in `node:sqlite` (stable in Node 22) — no native compilation,
 * no extra dependency, still a real, file-backed SQLite database as the architecture
 * document specifies.
 */
export function openDb(filePath: string): DatabaseSync {
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA foreign_keys = ON;");
  const schema = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
  return db;
}

let sharedDb: DatabaseSync | null = null;

/** Singleton accessor used by the Next.js app (server-side only). */
export function getDb(): DatabaseSync {
  if (!sharedDb) {
    const dbPath = process.env.WANGO_KB_DB_PATH ?? path.join(process.cwd(), "data", "kb.sqlite");
    sharedDb = openDb(dbPath);
  }
  return sharedDb;
}
