import { DAY_ROLLOVER_HOUR } from './date'

/** A local time of day, `HH:mm` (24h). */
export type TimeOfDay = `${number}:${number}`

const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/
const MINUTES_PER_DAY = 24 * 60

export function isTimeOfDay(value: string): value is TimeOfDay {
  return TIME_OF_DAY.test(value)
}

/** Minutes since 00:00. */
export function timeToMinutes(value: TimeOfDay): number {
  const match = TIME_OF_DAY.exec(value)
  if (!match) throw new Error(`Invalid time of day: ${value}`)
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * Minutes on the habit-day clock, where times before 04:00 come after 23:59
 * (00:30 → 24:30), because they still belong to the previous day.
 */
function habitDayMinutes(value: TimeOfDay): number {
  const minutes = timeToMinutes(value)
  return minutes < DAY_ROLLOVER_HOUR * 60 ? minutes + MINUTES_PER_DAY : minutes
}

/**
 * How far `actual` is from `goal`, in minutes. Negative = early, positive = late.
 * Example: goal 22:00, actual 00:30 → +150 (two and a half hours late).
 */
export function minutesFromGoal(actual: TimeOfDay, goal: TimeOfDay): number {
  return habitDayMinutes(actual) - habitDayMinutes(goal)
}

/** On time means at or before the goal. */
export function isOnTime(actual: TimeOfDay, goal: TimeOfDay): boolean {
  return minutesFromGoal(actual, goal) <= 0
}

/** Human label for a delta: "on time", "12 min early", "1 h 5 min late". */
export function formatMinutesFromGoal(delta: number): string {
  if (delta === 0) return 'on time'
  const abs = Math.abs(delta)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  const amount = hours === 0 ? `${minutes} min` : minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
  return `${amount} ${delta < 0 ? 'early' : 'late'}`
}
