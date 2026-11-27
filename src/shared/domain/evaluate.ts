import { eachDay, weekStartOf, type IsoDate } from './date'
import { meetsScaleRule, type Habit, type HabitLog, type LogValue } from './habit'
import { isOnTime } from './time'

/**
 * The outcome of one habit on one day.
 * - `success` / `fail`: the day counts toward streaks and the success rate.
 * - `pending`: today, not decided yet. It never breaks a streak.
 * - `tracked` / `untracked`: scale habit without a rule (trend only), logged or not.
 * - `inactive`: before the start date or after archiving.
 * - `future`: after today.
 */
export type DayStatus = 'success' | 'fail' | 'pending' | 'tracked' | 'untracked' | 'inactive' | 'future'

/** Logs of one habit indexed by date, for fast lookups. */
export type LogIndex = ReadonlyMap<IsoDate, LogValue>

export function indexLogs(logs: readonly HabitLog[]): LogIndex {
  return new Map(logs.map((log) => [log.date, log.value]))
}

function valueOf<T extends LogValue['type']>(
  logs: LogIndex,
  date: IsoDate,
  type: T,
): Extract<LogValue, { type: T }> | undefined {
  const value = logs.get(date)
  return value?.type === type ? (value as Extract<LogValue, { type: T }>) : undefined
}

function countOn(logs: LogIndex, date: IsoDate): number {
  return valueOf(logs, date, 'COUNT')?.count ?? 0
}

/** Weekly-limit total from Monday up to and including `date`. */
export function weekCountThrough(logs: LogIndex, date: IsoDate): number {
  return eachDay(weekStartOf(date), date).reduce((sum, day) => sum + countOn(logs, day), 0)
}

export function isActiveOn(habit: Habit, date: IsoDate): boolean {
  return date >= habit.startDate && (habit.archivedDate === undefined || date < habit.archivedDate)
}

/**
 * Scores one day. Rules:
 * - Daily check: done → success; not logged → miss (pending today).
 * - Daily limit: count ≤ max → success; no log counts as 0. Over the limit fails at once,
 *   within the limit today is still pending.
 * - Weekly limit: the week total up to that day ≤ max (weeks start Monday).
 * - Target time: at or before the goal → success; not logged → miss (pending today).
 * - Daily scale: with a rule, scored like a check; without one, only tracked.
 */
export function evaluateDay(habit: Habit, logs: LogIndex, date: IsoDate, today: IsoDate): DayStatus {
  if (date > today) return 'future'
  if (!isActiveOn(habit, date)) return 'inactive'
  const isToday = date === today
  const target = habit.target

  switch (target.type) {
    case 'DAILY_CHECK': {
      if (valueOf(logs, date, 'CHECK')?.done) return 'success'
      return isToday ? 'pending' : 'fail'
    }
    case 'DAILY_LIMIT': {
      if (countOn(logs, date) > target.max) return 'fail'
      return isToday ? 'pending' : 'success'
    }
    case 'WEEKLY_LIMIT': {
      if (weekCountThrough(logs, date) > target.max) return 'fail'
      return isToday ? 'pending' : 'success'
    }
    case 'TARGET_TIME': {
      const logged = valueOf(logs, date, 'TIME')
      if (logged) return isOnTime(logged.time, target.goal) ? 'success' : 'fail'
      return isToday ? 'pending' : 'fail'
    }
    case 'DAILY_SCALE': {
      const logged = valueOf(logs, date, 'SCALE')
      if (!target.rule) return logged ? 'tracked' : 'untracked'
      if (logged) return meetsScaleRule(logged.level, target.rule) ? 'success' : 'fail'
      return isToday ? 'pending' : 'fail'
    }
  }
}

/** Statuses for every day in a range, e.g. one row of the month grid. */
export function evaluateRange(
  habit: Habit,
  logs: LogIndex,
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
): Map<IsoDate, DayStatus> {
  return new Map(eachDay(from, to).map((date) => [date, evaluateDay(habit, logs, date, today)]))
}
