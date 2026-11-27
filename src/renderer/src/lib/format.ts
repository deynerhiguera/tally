import { parseIsoDate, type IsoDate } from '@shared/domain/date'
import type { HabitKind, HabitTarget, HabitTargetType } from '@shared/domain/habit'

export const TARGET_TYPE_LABEL: Record<HabitTargetType, string> = {
  DAILY_CHECK: 'Daily check',
  DAILY_LIMIT: 'Daily limit',
  WEEKLY_LIMIT: 'Weekly limit',
  TARGET_TIME: 'Target time',
  DAILY_SCALE: 'Daily scale 1–5',
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
    case 'TARGET_TIME':
      return `By ${target.goal}`
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
