import type { IsoDate } from './date'
import type { Habit, HabitTarget, LogValue } from './habit'
import { indexLogs, type LogIndex } from './evaluate'

/** Builds a habit for tests. Not used by production code. */
export function makeHabit(target: HabitTarget, overrides: Partial<Habit> = {}): Habit {
  return { id: 'h1', name: 'Test habit', kind: 'BUILD', target, startDate: '2026-01-01', ...overrides }
}

/** Builds a log index from `{ date: value }` pairs. */
export function makeLogs(entries: Record<string, LogValue>): LogIndex {
  return indexLogs(
    Object.entries(entries).map(([date, value]) => ({ habitId: 'h1', date: date as IsoDate, value })),
  )
}

export const check = (done = true): LogValue => ({ type: 'CHECK', done })
export const count = (n: number): LogValue => ({ type: 'COUNT', count: n })
