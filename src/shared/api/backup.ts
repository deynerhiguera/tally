import type { IsoDate } from '../domain/date'
import { validateLogValue, type Habit, type HabitLog } from '../domain/habit'
import { InvalidInputError, parseDate, parseHabitInput, parseHabitLog, parseId } from './parse'

/**
 * Version of the backup file format. Bump it when the shape changes and teach
 * `parseBackup` to read the older versions.
 */
export const BACKUP_SCHEMA_VERSION = 1

/** A complete copy of the user's data. Habits are listed in display order. */
export interface Backup {
  app: 'tally'
  schemaVersion: number
  exportedAt: string
  habits: Habit[]
  logs: HabitLog[]
}

export interface BackupSummary {
  exportedAt: string
  habits: number
  archivedHabits: number
  logs: number
  /** First and last logged day, or null when there are no logs. */
  firstDate: IsoDate | null
  lastDate: IsoDate | null
}

export function createBackup(habits: Habit[], logs: HabitLog[], now: Date = new Date()): Backup {
  return { app: 'tally', schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(), habits, logs }
}

export function summarizeBackup(backup: Backup): BackupSummary {
  const dates = backup.logs.map((log) => log.date).sort()
  return {
    exportedAt: backup.exportedAt,
    habits: backup.habits.length,
    archivedHabits: backup.habits.filter((habit) => habit.archivedDate !== undefined).length,
    logs: backup.logs.length,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(message: string): never {
  throw new InvalidInputError(message)
}

function parseHabit(value: unknown, position: number): Habit {
  if (!isRecord(value)) fail(`Habit ${position + 1} is not an object.`)
  try {
    const habit: Habit = { id: parseId(value['id']), ...parseHabitInput(value) }
    if (value['archivedDate'] !== undefined && value['archivedDate'] !== null) {
      habit.archivedDate = parseDate(value['archivedDate'], 'archivedDate')
    }
    return habit
  } catch (error) {
    fail(`Habit ${position + 1}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Validates an untrusted backup (already JSON-parsed) completely before anything is replaced:
 * format and version, every habit, every log, and that each log matches its habit's target.
 */
export function parseBackup(value: unknown): Backup {
  if (!isRecord(value) || value['app'] !== 'tally') fail('This file is not a Tally backup.')

  const version = value['schemaVersion']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    fail('The backup has no valid schema version.')
  }
  if (version > BACKUP_SCHEMA_VERSION) {
    fail(`This backup was made by a newer version of Tally (format ${version}). Update the app to import it.`)
  }

  const exportedAt = value['exportedAt']
  if (typeof exportedAt !== 'string' || Number.isNaN(Date.parse(exportedAt))) {
    fail('The backup has no valid export date.')
  }

  if (!Array.isArray(value['habits'])) fail('The backup has no habit list.')
  if (!Array.isArray(value['logs'])) fail('The backup has no log list.')

  const habits = value['habits'].map(parseHabit)
  const byId = new Map(habits.map((habit) => [habit.id, habit]))
  if (byId.size !== habits.length) fail('The backup contains the same habit twice.')

  const seen = new Set<string>()
  const logs = value['logs'].map((raw: unknown, i: number) => {
    let log: HabitLog
    try {
      log = parseHabitLog(raw)
    } catch (error) {
      fail(`Log ${i + 1}: ${error instanceof Error ? error.message : String(error)}`)
    }
    const habit = byId.get(log.habitId) ?? fail(`Log ${i + 1} belongs to a habit that is not in the backup.`)
    const problems = validateLogValue(habit.target, log.value)
    if (problems.length > 0) fail(`Log ${i + 1}: ${problems.join(' ')}`)
    const key = `${log.habitId}|${log.date}`
    if (seen.has(key)) fail(`Log ${i + 1} repeats a habit and day that is already in the backup.`)
    seen.add(key)
    return log
  })

  return { app: 'tally', schemaVersion: version, exportedAt, habits, logs }
}
