import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { HabitInput } from '@shared/api/habit-repository'
import { InvalidInputError } from '@shared/api/parse'
import type { IsoDate } from '@shared/domain/date'
import { validateLogValue, type Habit, type HabitLog, type LogValue } from '@shared/domain/habit'

interface HabitRow {
  id: string
  name: string
  kind: Habit['kind']
  target: string
  start_date: IsoDate
  archived_date: IsoDate | null
}

interface LogRow {
  habit_id: string
  date: IsoDate
  value: string
}

function toHabit(row: HabitRow): Habit {
  const habit: Habit = {
    id: row.id,
    name: row.name,
    kind: row.kind,
    target: JSON.parse(row.target) as Habit['target'],
    startDate: row.start_date,
  }
  if (row.archived_date !== null) habit.archivedDate = row.archived_date
  return habit
}

function toLog(row: LogRow): HabitLog {
  return { habitId: row.habit_id, date: row.date, value: JSON.parse(row.value) as LogValue }
}

const HABIT_COLUMNS = 'id, name, kind, target, start_date, archived_date'

/**
 * Synchronous SQLite storage for habits and logs. Runs in the main process only.
 * Inputs are expected to be parsed already (see `@shared/api/parse`); this class enforces
 * the rules that need the database, such as "a log must match its habit's target".
 */
export class HabitStore {
  constructor(
    private readonly db: DatabaseSync,
    private readonly now: () => Date = () => new Date(),
  ) {}

  listHabits(): Habit[] {
    const rows = this.db.prepare(`SELECT ${HABIT_COLUMNS} FROM habits ORDER BY position, created_at`).all()
    return (rows as unknown as HabitRow[]).map(toHabit)
  }

  getHabit(id: string): Habit {
    const row = this.db.prepare(`SELECT ${HABIT_COLUMNS} FROM habits WHERE id = ?`).get(id)
    if (!row) throw new InvalidInputError(`Habit ${id} does not exist.`)
    return toHabit(row as unknown as HabitRow)
  }

  createHabit(input: HabitInput): Habit {
    const id = randomUUID()
    const timestamp = this.now().toISOString()
    const { next } = this.db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM habits').get() as {
      next: number
    }
    this.db
      .prepare(
        `INSERT INTO habits (id, name, kind, target, start_date, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.kind,
        JSON.stringify(input.target),
        input.startDate,
        next,
        timestamp,
        timestamp,
      )
    return this.getHabit(id)
  }

  updateHabit(id: string, input: HabitInput): Habit {
    const existing = this.getHabit(id)
    if (existing.target.type !== input.target.type) {
      throw new InvalidInputError(
        "A habit's target type can't change. Archive it and create a new habit instead.",
      )
    }
    this.db
      .prepare(
        'UPDATE habits SET name = ?, kind = ?, target = ?, start_date = ?, updated_at = ? WHERE id = ?',
      )
      .run(
        input.name,
        input.kind,
        JSON.stringify(input.target),
        input.startDate,
        this.now().toISOString(),
        id,
      )
    return this.getHabit(id)
  }

  archiveHabit(id: string, date: IsoDate): Habit {
    this.getHabit(id)
    this.db
      .prepare('UPDATE habits SET archived_date = ?, updated_at = ? WHERE id = ?')
      .run(date, this.now().toISOString(), id)
    return this.getHabit(id)
  }

  unarchiveHabit(id: string): Habit {
    this.getHabit(id)
    this.db
      .prepare('UPDATE habits SET archived_date = NULL, updated_at = ? WHERE id = ?')
      .run(this.now().toISOString(), id)
    return this.getHabit(id)
  }

  reorderHabits(ids: string[]): void {
    const existing = this.listHabits().map((habit) => habit.id)
    const sameSet = ids.length === existing.length && existing.every((id) => ids.includes(id))
    if (!sameSet) throw new InvalidInputError('Reorder must list every habit exactly once.')
    this.transaction(() => {
      const update = this.db.prepare('UPDATE habits SET position = ? WHERE id = ?')
      ids.forEach((id, position) => update.run(position, id))
    })
  }

  listLogsInRange(from: IsoDate, to: IsoDate): HabitLog[] {
    const rows = this.db
      .prepare('SELECT habit_id, date, value FROM logs WHERE date BETWEEN ? AND ? ORDER BY date, habit_id')
      .all(from, to)
    return (rows as unknown as LogRow[]).map(toLog)
  }

  listLogsForHabit(habitId: string): HabitLog[] {
    const rows = this.db
      .prepare('SELECT habit_id, date, value FROM logs WHERE habit_id = ? ORDER BY date')
      .all(habitId)
    return (rows as unknown as LogRow[]).map(toLog)
  }

  setLog(log: HabitLog): void {
    const habit = this.getHabit(log.habitId)
    const problems = validateLogValue(habit.target, log.value)
    if (problems.length > 0) throw new InvalidInputError(problems.join(' '))
    this.db
      .prepare(
        `INSERT INTO logs (habit_id, date, value, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (habit_id, date) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(log.habitId, log.date, JSON.stringify(log.value), this.now().toISOString())
  }

  clearLog(habitId: string, date: IsoDate): void {
    this.db.prepare('DELETE FROM logs WHERE habit_id = ? AND date = ?').run(habitId, date)
  }

  private transaction(work: () => void): void {
    this.db.exec('BEGIN')
    try {
      work()
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
}
