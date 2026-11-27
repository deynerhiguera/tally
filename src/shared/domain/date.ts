/**
 * Calendar helpers on plain `YYYY-MM-DD` strings in local time.
 * Pure functions: no Electron, Node or React imports allowed in src/shared/domain.
 */

export type IsoDate = `${number}-${number}-${number}`

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}` as IsoDate
}

export function parseIsoDate(value: string): Date {
  const match = ISO_DATE.exec(value)
  if (!match) throw new Error(`Invalid ISO date: ${value}`)
  const [, y, m, d] = match.map(Number) as [number, number, number, number]
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    throw new Error(`Invalid ISO date: ${value}`)
  }
  return date
}

/** Number of days in a month. `month` is 1–12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function isWeekend(value: IsoDate): boolean {
  const day = parseIsoDate(value).getDay()
  return day === 0 || day === 6
}

/** Returns the date `days` after `value` (negative goes back). DST-safe: works on calendar days. */
export function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(value)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** Monday of the week that contains `value`. Weeks start on Monday. */
export function weekStartOf(value: IsoDate): IsoDate {
  const offsetFromMonday = (parseIsoDate(value).getDay() + 6) % 7
  return addDays(value, -offsetFromMonday)
}

/** Every date from `from` to `to`, both inclusive. Empty when `from` is after `to`. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}

/** Hour (local time) before which a moment still belongs to the previous day. */
export const DAY_ROLLOVER_HOUR = 4

/**
 * The habit day a moment belongs to: before 04:00 it still counts as the previous day,
 * so logging a 00:30 bedtime lands on the evening it belongs to.
 */
export function logicalDateOf(moment: Date): IsoDate {
  const today = toIsoDate(moment)
  return moment.getHours() < DAY_ROLLOVER_HOUR ? addDays(today, -1) : today
}

/** Days of the week, Monday first (weeks start on Monday in Tally). */
export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'string' && (WEEKDAYS as readonly string[]).includes(value)
}

export function weekdayOf(value: IsoDate): Weekday {
  // getDay(): 0 = Sunday … 6 = Saturday.
  return WEEKDAYS[(parseIsoDate(value).getDay() + 6) % 7] as Weekday
}
