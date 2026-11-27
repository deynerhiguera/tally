import { isWeekday, weekdayOf, WEEKDAYS, type IsoDate, type Weekday } from './date'
import { isTimeOfDay, type TimeOfDay } from './time'

/** BUILD: something to do. BREAK: something to keep inside a limit. */
export type HabitKind = 'BUILD' | 'BREAK'

export type ScaleLevel = 1 | 2 | 3 | 4 | 5

/** When a scale habit counts as a good day, e.g. stress `{ op: 'lte', value: 2 }`. */
export interface ScaleRule {
  op: 'lte' | 'gte'
  value: ScaleLevel
}

/** What a habit measures and what counts as success. */
export type HabitTarget =
  | { type: 'DAILY_CHECK' }
  | { type: 'DAILY_LIMIT'; max: number }
  | { type: 'WEEKLY_LIMIT'; max: number }
  | { type: 'WEEKLY_GOAL'; min: number }
  | {
      type: 'TARGET_TIME'
      /** The goal on every day without its own goal below. */
      goal: TimeOfDay
      /** Optional different goal on some weekdays, e.g. 23:30 on Friday and Saturday. */
      goalByDay?: Partial<Record<Weekday, TimeOfDay>>
    }
  | { type: 'DAILY_SCALE'; rule?: ScaleRule }

export type HabitTargetType = HabitTarget['type']

export interface Habit {
  id: string
  name: string
  kind: HabitKind
  target: HabitTarget
  /** First day the habit is tracked. Earlier days are not evaluated. */
  startDate: IsoDate
  /** Set when archived. Days from this date on are not evaluated. */
  archivedDate?: IsoDate
  /**
   * Weekdays the habit applies to. Absent means every day. On other days the habit is
   * not shown, not counted, and skipped by streaks.
   */
  activeDays?: Weekday[]
  /** Optional free text shown on the habit's page, e.g. the rules being practiced. */
  description?: string
}

/** Longest description a habit can have. */
export const MAX_DESCRIPTION_LENGTH = 1000

/** True when the habit applies on that weekday (its schedule allows it). */
export function isScheduledOn(habit: Habit, date: IsoDate): boolean {
  return habit.activeDays === undefined || habit.activeDays.includes(weekdayOf(date))
}

/** The goal time for a target-time habit on a given date, taking per-weekday goals into account. */
export function goalOn(target: Extract<HabitTarget, { type: 'TARGET_TIME' }>, date: IsoDate): TimeOfDay {
  return target.goalByDay?.[weekdayOf(date)] ?? target.goal
}

/** Returns a list of problems with a schedule; empty means valid. */
export function validateActiveDays(days: readonly unknown[]): string[] {
  if (days.length === 0) return ['Pick at least one day.']
  if (!days.every(isWeekday)) return ['Days must be MON to SUN.']
  if (new Set(days).size !== days.length) return ['Days must not repeat.']
  return []
}

/** Sorts days Monday first and drops the list when it covers the whole week (same as no schedule). */
export function normalizeActiveDays(days: readonly Weekday[]): Weekday[] | undefined {
  const sorted = WEEKDAYS.filter((day) => days.includes(day))
  return sorted.length === WEEKDAYS.length ? undefined : sorted
}

/** The value logged for one habit on one day. Its shape depends on the target type. */
/** Every logged value can carry a short note, e.g. the gym session type or what triggered a slip. */
interface WithNote {
  note?: string
}

export type LogValue =
  | ({ type: 'CHECK'; done: boolean } & WithNote)
  | ({ type: 'COUNT'; count: number } & WithNote)
  | ({ type: 'TIME'; time: TimeOfDay } & WithNote)
  | ({ type: 'SCALE'; level: ScaleLevel } & WithNote)

/** A copy of `value` with `note` set, or removed when the note is empty or only spaces. */
export function withNote<T extends LogValue>(value: T, note: string | undefined): T {
  const copy = { ...value }
  const trimmed = note?.trim()
  if (trimmed) copy.note = trimmed
  else delete copy.note
  return copy
}

export interface HabitLog {
  habitId: string
  date: IsoDate
  value: LogValue
}

/** Which log value type each target type expects. */
export const LOG_VALUE_TYPE = {
  DAILY_CHECK: 'CHECK',
  DAILY_LIMIT: 'COUNT',
  WEEKLY_LIMIT: 'COUNT',
  WEEKLY_GOAL: 'COUNT',
  TARGET_TIME: 'TIME',
  DAILY_SCALE: 'SCALE',
} as const satisfies Record<HabitTargetType, LogValue['type']>

export function isScaleLevel(value: unknown): value is ScaleLevel {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}

function isLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** Returns a list of problems; empty means the target is valid. */
export function validateTarget(target: HabitTarget): string[] {
  switch (target.type) {
    case 'DAILY_CHECK':
      return []
    case 'DAILY_LIMIT':
    case 'WEEKLY_LIMIT':
      return isLimit(target.max) ? [] : ['Limit must be a whole number of 0 or more.']
    case 'WEEKLY_GOAL':
      return isLimit(target.min) && target.min >= 1
        ? []
        : ['Weekly goal must be a whole number of 1 or more.']
    case 'TARGET_TIME': {
      if (!isTimeOfDay(target.goal)) return ['Goal time must be HH:mm.']
      const perDay = Object.entries(target.goalByDay ?? {})
      const valid = perDay.every(
        ([day, time]) => isWeekday(day) && typeof time === 'string' && isTimeOfDay(time),
      )
      return valid ? [] : ['Goals per day must be HH:mm on MON to SUN.']
    }
    case 'DAILY_SCALE':
      if (!target.rule) return []
      return ['lte', 'gte'].includes(target.rule.op) && isScaleLevel(target.rule.value)
        ? []
        : ['Scale rule must be ≤ or ≥ a level from 1 to 5.']
  }
}

/** Returns a list of problems; empty means the value is valid for this target. */
export function validateLogValue(target: HabitTarget, value: LogValue): string[] {
  if (value.type !== LOG_VALUE_TYPE[target.type]) {
    return [`A ${target.type} habit needs a ${LOG_VALUE_TYPE[target.type]} value, got ${value.type}.`]
  }
  switch (value.type) {
    case 'CHECK':
      return typeof value.done === 'boolean' ? [] : ['Done must be true or false.']
    case 'COUNT':
      return isLimit(value.count) ? [] : ['Count must be a whole number of 0 or more.']
    case 'TIME':
      return isTimeOfDay(value.time) ? [] : ['Time must be HH:mm.']
    case 'SCALE':
      return isScaleLevel(value.level) ? [] : ['Level must be 1 to 5.']
  }
}

/** True when the scale level is a good day under the rule. */
export function meetsScaleRule(level: ScaleLevel, rule: ScaleRule): boolean {
  return rule.op === 'lte' ? level <= rule.value : level >= rule.value
}
