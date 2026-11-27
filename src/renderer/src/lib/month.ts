import { daysInMonth, isWeekend, type IsoDate } from '@shared/domain/date'
import type { DayStatus } from '@shared/domain/evaluate'
import { goalOn, type Habit, type LogValue } from '@shared/domain/habit'
import { minutesFromGoal } from '@shared/domain/time'

/** A calendar month, `month` 1–12. */
export interface YearMonth {
  year: number
  month: number
}

export function monthOf(date: IsoDate): YearMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) }
}

/** `YYYY-MM`, used in the `?month=` search param. */
export function formatMonthParam({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Reads `?month=YYYY-MM`; anything else (or a month after `latest`) gives `latest`. */
export function parseMonthParam(param: string | null, latest: YearMonth): YearMonth {
  const match = param ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(param) : null
  if (!match) return latest
  const parsed = { year: Number(match[1]), month: Number(match[2]) }
  return compareMonths(parsed, latest) > 0 ? latest : parsed
}

export function compareMonths(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}

export function shiftMonth({ year, month }: YearMonth, offset: number): YearMonth {
  const index = year * 12 + (month - 1) + offset
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export interface MonthDay {
  date: IsoDate
  day: number
  weekdayInitial: string
  weekend: boolean
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function monthDays({ year, month }: YearMonth): MonthDay[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}` as IsoDate
    return {
      date,
      day: i + 1,
      weekdayInitial: WEEKDAY_INITIALS[new Date(year, month - 1, i + 1).getDay()] as string,
      weekend: isWeekend(date),
    }
  })
}

const MONTH_TITLE = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

/** "November 2026" */
export function formatMonthTitle({ year, month }: YearMonth): string {
  return MONTH_TITLE.format(new Date(year, month - 1, 1))
}

/** True if the habit is active on at least one day of the month. */
export function isActiveInMonth(habit: Habit, first: IsoDate, last: IsoDate): boolean {
  return habit.startDate <= last && (habit.archivedDate === undefined || habit.archivedDate > first)
}

/**
 * The short text inside a grid cell, like a mark on a paper tracker:
 * ✓ for a done check, the count for limits, minutes from the goal for times, the level for scales.
 */
export function cellText(
  habit: Habit,
  value: LogValue | undefined,
  status: DayStatus,
  date: IsoDate,
): string {
  if (status === 'future' || status === 'inactive' || !value) return ''
  switch (value.type) {
    case 'CHECK':
      return value.done ? '✓' : ''
    case 'COUNT':
      return value.count > 0 ? String(value.count) : ''
    case 'TIME': {
      if (habit.target.type !== 'TARGET_TIME') return ''
      const delta = minutesFromGoal(value.time, goalOn(habit.target, date))
      return delta === 0 ? '0' : delta > 0 ? `+${delta}` : `−${-delta}`
    }
    case 'SCALE':
      return String(value.level)
  }
}

function describeBase(value: LogValue): string {
  switch (value.type) {
    case 'CHECK':
      return value.done ? 'done' : 'not done'
    case 'COUNT':
      return `count ${value.count}`
    case 'TIME':
      return `at ${value.time}`
    case 'SCALE':
      return `level ${value.level}`
  }
}

/** Longer description of a logged value, with its note, for tooltips, history and screen readers. */
export function describeValue(value: LogValue | undefined): string {
  if (!value) return 'nothing logged'
  return value.note ? `${describeBase(value)} (${value.note})` : describeBase(value)
}
