import { addDays, eachDay, weekStartOf, type IsoDate } from './date'
import { evaluateDay, type DayStatus, type LogIndex } from './evaluate'
import type { Habit, ScaleLevel } from './habit'
import { minutesFromGoal } from './time'

const COUNTS: ReadonlySet<DayStatus> = new Set(['success', 'fail'])

/** Last day a habit can be scored: today, or the day before it was archived. */
function lastScoredDay(habit: Habit, today: IsoDate): IsoDate {
  if (habit.archivedDate !== undefined && habit.archivedDate <= today) return addDays(habit.archivedDate, -1)
  return today
}

/** Weekly goals are measured in weeks; every other habit in days. */
export type StreakUnit = 'day' | 'week'

export function streakUnit(habit: Habit): StreakUnit {
  return habit.target.type === 'WEEKLY_GOAL' ? 'week' : 'day'
}

/**
 * The status of each period (day, or Monday–Sunday week for weekly goals) from `from` to `to`,
 * oldest first. A week takes the status of its last day inside the range.
 */
function periodStatuses(
  habit: Habit,
  logs: LogIndex,
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
): DayStatus[] {
  if (streakUnit(habit) === 'day') return eachDay(from, to).map((day) => evaluateDay(habit, logs, day, today))
  const statuses: DayStatus[] = []
  for (let week = weekStartOf(from); week <= to; week = addDays(week, 7)) {
    const weekEnd = addDays(week, 6)
    statuses.push(evaluateDay(habit, logs, weekEnd < to ? weekEnd : to, today))
  }
  return statuses
}

/**
 * Consecutive successful periods (days, or weeks for weekly goals) ending now. A pending
 * current period is skipped, so the streak stays alive until it is over. Scale habits
 * without a rule have no streak (0).
 */
export function currentStreak(habit: Habit, logs: LogIndex, today: IsoDate): number {
  const statuses = periodStatuses(habit, logs, habit.startDate, lastScoredDay(habit, today), today)
  let streak = 0
  for (const status of statuses.reverse()) {
    if (status === 'pending') continue
    if (status !== 'success') break
    streak++
  }
  return streak
}

/** Longest run of successful periods since the start date. A pending period neither adds nor breaks. */
export function bestStreak(habit: Habit, logs: LogIndex, today: IsoDate): number {
  let best = 0
  let run = 0
  for (const status of periodStatuses(habit, logs, habit.startDate, lastScoredDay(habit, today), today)) {
    if (status === 'pending') continue
    run = status === 'success' ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

export interface SuccessRate {
  successes: number
  /** Periods that were decided: successes plus failures. Pending, inactive and future ones are left out. */
  scored: number
  /** successes / scored, from 0 to 1. `null` when nothing was scored. */
  rate: number | null
  /** What was counted: days, or weeks for weekly goals. */
  unit: StreakUnit
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
  for (const status of periodStatuses(habit, logs, from, to, today)) {
    if (!COUNTS.has(status)) continue
    scored++
    if (status === 'success') successes++
  }
  return { successes, scored, rate: scored === 0 ? null : successes / scored, unit: streakUnit(habit) }
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
