import type { HabitTarget } from '@shared/domain/habit'
import { describeSchedule, describeTarget, formatDays, formatDayTitle, formatShortDate } from './format'

describe('describeTarget', () => {
  it.each<[HabitTarget, string]>([
    [{ type: 'DAILY_CHECK' }, 'Daily check'],
    [{ type: 'DAILY_LIMIT', max: 1 }, 'At most 1 per day'],
    [{ type: 'WEEKLY_LIMIT', max: 1 }, 'At most 1 per week'],
    [{ type: 'WEEKLY_GOAL', min: 3 }, 'At least 3 per week'],
    [{ type: 'TARGET_TIME', goal: '05:00' }, 'By 05:00'],
    [
      { type: 'TARGET_TIME', goal: '22:00', goalByDay: { FRI: '23:30', SAT: '23:30' } },
      'By 22:00 · Fri, Sat 23:30',
    ],
    [
      { type: 'TARGET_TIME', goal: '22:00', goalByDay: { FRI: '23:30', SAT: '23:30', SUN: '21:30' } },
      'By 22:00 · Fri, Sat 23:30 · Sun 21:30',
    ],
    [{ type: 'DAILY_SCALE' }, 'Scale 1–5'],
    [{ type: 'DAILY_SCALE', rule: { op: 'lte', value: 2 } }, 'Scale 1–5 · good if ≤ 2'],
    [{ type: 'DAILY_SCALE', rule: { op: 'gte', value: 4 } }, 'Scale 1–5 · good if ≥ 4'],
  ])('%j → %s', (target, label) => {
    expect(describeTarget(target)).toBe(label)
  })
})

describe('formatDayTitle', () => {
  it('formats weekday, month and day', () => {
    expect(formatDayTitle('2026-11-27')).toBe('Friday, November 27')
  })
})

describe('formatShortDate', () => {
  it('formats month and day', () => {
    expect(formatShortDate('2026-11-03')).toBe('Nov 3')
  })
})

describe('formatDays and describeSchedule', () => {
  it('turns runs of three or more days into ranges, Monday first', () => {
    expect(formatDays(['FRI', 'MON', 'TUE', 'WED', 'THU'])).toBe('Mon–Fri')
    expect(formatDays(['SAT', 'SUN'])).toBe('Sat, Sun')
    expect(formatDays(['MON', 'WED', 'FRI'])).toBe('Mon, Wed, Fri')
    expect(formatDays(['MON', 'TUE', 'WED', 'SAT'])).toBe('Mon–Wed, Sat')
  })

  it('says every day without a schedule', () => {
    expect(describeSchedule(undefined)).toBe('Every day')
    expect(describeSchedule(['MON', 'TUE', 'WED', 'THU', 'FRI'])).toBe('Mon–Fri')
  })
})
