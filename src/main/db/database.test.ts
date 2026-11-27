// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { MIGRATIONS, migrate, openDatabase, schemaVersion } from './database'

describe('openDatabase', () => {
  const dirs: string[] = []
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })))

  it('creates the schema and records its version', () => {
    const db = openDatabase(':memory:')
    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all()
    expect(tables.map((row) => row['name'])).toEqual(['habits', 'logs'])
  })

  it('keeps data when the file is opened again (app restart or reinstall)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tally-'))
    dirs.push(dir)
    const path = join(dir, 'tally.db')

    const first = openDatabase(path)
    first
      .prepare(
        `INSERT INTO habits (id, name, kind, target, start_date, position, created_at, updated_at)
         VALUES ('h1', 'Anki', 'BUILD', '{"type":"DAILY_CHECK"}', '2026-11-27', 0, 'x', 'x')`,
      )
      .run()
    first.close()

    const second = openDatabase(path)
    expect(second.prepare('SELECT name FROM habits').get()).toEqual({ name: 'Anki' })
    expect(second.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' })
    second.close()
  })

  it('enables foreign keys', () => {
    expect(openDatabase(':memory:').prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
  })
})

describe('migrate', () => {
  it('runs only the migrations that are missing', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, ['CREATE TABLE a (x)'])
    migrate(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (x)'])
    expect(schemaVersion(db)).toBe(2)
  })

  it('rolls back a failing migration and keeps the previous version', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, ['CREATE TABLE a (x)'])
    expect(() => migrate(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (x); NOT VALID SQL'])).toThrow()
    expect(schemaVersion(db)).toBe(1)
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'b'").get()).toBeUndefined()
  })

  it('refuses a database from a newer app version', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA user_version = 99')
    expect(() => migrate(db)).toThrow('newer version of Tally')
  })
})

describe('migration 2: schedules', () => {
  it('adds an active_days column to an existing version 1 database, keeping its habits', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, MIGRATIONS.slice(0, 1))
    db.prepare(
      "INSERT INTO habits VALUES ('h1', 'Anki', 'BUILD', '{\"type\":\"DAILY_CHECK\"}', '2026-11-27', NULL, 0, 'x', 'x')",
    ).run()

    migrate(db)
    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(db.prepare('SELECT name, active_days FROM habits').get()).toEqual({
      name: 'Anki',
      active_days: null,
    })
  })
})

describe('migration 3: descriptions', () => {
  it('adds an empty description column', () => {
    const db = openDatabase(':memory:')
    const columns = db
      .prepare('PRAGMA table_info(habits)')
      .all()
      .map((column) => column['name'])
    expect(columns).toContain('description')
  })
})
