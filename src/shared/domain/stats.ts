import { addDays, eachDay, type IsoDate } from './date'
import { evaluateDay, type DayStatus, type LogIndex } from './evaluate'
import type { Habit, ScaleLevel } from './habit'
import { minutesFromGoal } from './time'

const COUNTS: ReadonlySet<DayStatus> = new Set(['success', 'fail'])

/** Last day a habit can be scored: today, or the day before it was archived. */
function lastScoredDay(habit: Habit, today: IsoDate): IsoDate {
  if (habit.archivedDate !== undefined && habit.archivedDate <= today) return addDays(habit.archivedDate, -1)
  return today
}

/**
 * Consecutive successful days ending today. A pending today is skipped, so the streak
 * stays alive until the day is over. Scale habits without a rule have no streak (0).
 */
export function currentStreak(habit: Habit, logs: LogIndex, today: IsoDate): number {
  let streak = 0
  for (let day = lastScoredDay(habit, today); day >= habit.startDate; day = addDays(day, -1)) {
    const status = evaluateDay(habit, logs, day, today)
    if (status === 'pending') continue
    if (status !== 'success') break
    streak++
  }
  return streak
}

/** Longest run of successful days since the start date. A pending today neither adds nor breaks. */
export function bestStreak(habit: Habit, logs: LogIndex, today: IsoDate): number {
  let best = 0
  let run = 0
  for (const day of eachDay(habit.startDate, lastScoredDay(habit, today))) {
    const status = evaluateDay(habit, logs, day, today)
    if (status === 'pending') continue
    run = status === 'success' ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

export interface SuccessRate {
  successes: number
  /** Days that were decided: successes plus failures. Pending, inactive and future days are left out. */
  scored: number
  /** successes / scored, from 0 to 1. `null` when no day was scored. */
  rate: number | null
}

export function successRate(
  habit: Habit,
  logs: LogIndex,
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
): SuccessRate {
  let successes = 0
  let scored = 0
  for (const day of eachDay(from, to)) {
    const status = evaluateDay(habit, logs, day, today)
    if (!COUNTS.has(status)) continue
    scored++
    if (status === 'success') successes++
  }
  return { successes, scored, rate: scored === 0 ? null : successes / scored }
}

/** Average minutes from the goal over logged days (negative = early on average). `null` if none. */
export function averageMinutesFromGoal(
  habit: Habit,
  logs: LogIndex,
  from: IsoDate,
  to: IsoDate,
): number | null {
  if (habit.target.type !== 'TARGET_TIME') return null
  const goal = habit.target.goal
  const deltas = eachDay(from, to).flatMap((day) => {
    const value = logs.get(day)
    return value?.type === 'TIME' ? [minutesFromGoal(value.time, goal)] : []
  })
  if (deltas.length === 0) return null
  return Math.round(deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length)
}

export interface TrendPoint {
  date: IsoDate
  /** `null` when nothing was logged that day, so a chart can show a gap. */
  level: ScaleLevel | null
}

/** One point per day for the scale trend chart. */
export function scaleTrend(logs: LogIndex, from: IsoDate, to: IsoDate): TrendPoint[] {
  return eachDay(from, to).map((date) => {
    const value = logs.get(date)
    return { date, level: value?.type === 'SCALE' ? value.level : null }
  })
}
