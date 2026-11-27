import { DatabaseSync } from 'node:sqlite'

/**
 * Schema migrations, applied in order. Never edit or reorder a shipped migration:
 * add a new one at the end. `PRAGMA user_version` stores how many have run.
 *
 * Targets and log values are stored as JSON so new habit types don't need a schema change.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE habits (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('BUILD', 'BREAK')),
    target        TEXT NOT NULL,
    start_date    TEXT NOT NULL,
    archived_date TEXT,
    position      INTEGER NOT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  ) STRICT;

  CREATE TABLE logs (
    habit_id   TEXT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (habit_id, date)
  ) STRICT;

  CREATE INDEX logs_by_date ON logs (date);
  `,
  // 2: optional schedule (JSON list of weekdays, NULL = every day).
  `ALTER TABLE habits ADD COLUMN active_days TEXT;`,
]

/** Opens (or creates) the database at `path` and brings its schema up to date. Use ':memory:' in tests. */
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  migrate(db)
  return db
}

export function schemaVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
  return row.user_version
}

export function migrate(db: DatabaseSync, migrations: readonly string[] = MIGRATIONS): void {
  const current = schemaVersion(db)
  if (current > migrations.length) {
    throw new Error(
      `The database is from a newer version of Tally (schema ${current}). Update the app to open it.`,
    )
  }
  for (let version = current; version < migrations.length; version++) {
    db.exec('BEGIN')
    try {
      db.exec(migrations[version] as string)
      db.exec(`PRAGMA user_version = ${version + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}
