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
