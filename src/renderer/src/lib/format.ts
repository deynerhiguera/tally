import { parseIsoDate, WEEKDAYS, type IsoDate, type Weekday } from '@shared/domain/date'
import type { Area, HabitKind, HabitTarget, HabitTargetType } from '@shared/domain/habit'

export const TARGET_TYPE_LABEL: Record<HabitTargetType, string> = {
  DAILY_CHECK: 'Daily check',
  DAILY_LIMIT: 'Daily limit',
  WEEKLY_LIMIT: 'Weekly limit',
  WEEKLY_GOAL: 'Weekly goal',
  TARGET_TIME: 'Target time',
  DAILY_SCALE: 'Daily scale 1–5',
}

export const AREA_LABEL: Record<Area, string> = {
  ENGLISH: 'English',
  CAREER: 'Career',
  ATHLETE: 'Athlete',
  BRAND: 'Brand',
  UNIVERSITY: 'University',
  LIFE: 'Life',
  SPIRIT: 'Spirit',
}

export const KIND_LABEL: Record<HabitKind, string> = {
  BUILD: 'Build',
  BREAK: 'Break',
}

/** One-line summary of a target, e.g. "At most 1 per week" or "By 05:00". */
export function describeTarget(target: HabitTarget): string {
  switch (target.type) {
    case 'DAILY_CHECK':
      return 'Daily check'
    case 'DAILY_LIMIT':
      return `At most ${target.max} per day`
    case 'WEEKLY_LIMIT':
      return `At most ${target.max} per week`
    case 'WEEKLY_GOAL':
      return `At least ${target.min} per week`
    case 'TARGET_TIME': {
      const exceptions = groupDaysByTime(target.goalByDay)
      return [`By ${target.goal}`, ...exceptions.map(([time, days]) => `${formatDays(days)} ${time}`)].join(
        ' · ',
      )
    }
    case 'DAILY_SCALE':
      if (!target.rule) return 'Scale 1–5'
      return `Scale 1–5 · good if ${target.rule.op === 'lte' ? '≤' : '≥'} ${target.rule.value}`
  }
}

const DAY_TITLE = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

/** "Friday, November 27" */
export function formatDayTitle(date: IsoDate): string {
  return DAY_TITLE.format(parseIsoDate(date))
}

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** "Nov 3" */
export function formatShortDate(date: IsoDate): string {
  return SHORT_DATE.format(parseIsoDate(date))
}

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
}

export const WEEKDAY_LONG: Record<Weekday, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
}

/** "Mon–Fri", "Sat, Sun", "Mon, Wed, Fri" – runs of 3 or more days become a range. Monday first. */
export function formatDays(days: readonly Weekday[]): string {
  const indexes = WEEKDAYS.flatMap((day, i) => (days.includes(day) ? [i] : []))
  const parts: string[] = []
  for (let i = 0; i < indexes.length;) {
    let j = i
    while (j + 1 < indexes.length && indexes[j + 1] === (indexes[j] as number) + 1) j++
    const first = WEEKDAY_SHORT[WEEKDAYS[indexes[i] as number] as Weekday]
    const last = WEEKDAY_SHORT[WEEKDAYS[indexes[j] as number] as Weekday]
    if (j - i >= 2) parts.push(`${first}–${last}`)
    else for (let k = i; k <= j; k++) parts.push(WEEKDAY_SHORT[WEEKDAYS[indexes[k] as number] as Weekday])
    i = j + 1
  }
  return parts.join(', ')
}

/** "Every day" or the formatted list of active days. */
export function describeSchedule(activeDays: readonly Weekday[] | undefined): string {
  return activeDays === undefined ? 'Every day' : formatDays(activeDays)
}

function groupDaysByTime(goalByDay: Partial<Record<Weekday, string>> | undefined): [string, Weekday[]][] {
  const groups = new Map<string, Weekday[]>()
  for (const day of WEEKDAYS) {
    const time = goalByDay?.[day]
    if (time) groups.set(time, [...(groups.get(time) ?? []), day])
  }
  return [...groups]
}
