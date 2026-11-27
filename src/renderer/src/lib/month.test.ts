import type { Habit } from '@shared/domain/habit'
import {
  cellText,
  compareMonths,
  describeValue,
  formatMonthParam,
  formatMonthTitle,
  isActiveInMonth,
  monthDays,
  monthOf,
  parseMonthParam,
  shiftMonth,
} from './month'

const NOV = { year: 2026, month: 11 }

describe('month params', () => {
  it('reads and writes YYYY-MM', () => {
    expect(monthOf('2026-11-27')).toEqual(NOV)
    expect(formatMonthParam({ year: 2026, month: 3 })).toBe('2026-03')
    expect(parseMonthParam('2026-03', NOV)).toEqual({ year: 2026, month: 3 })
  })

  it('falls back to the latest month for invalid or future values', () => {
    expect(parseMonthParam(null, NOV)).toEqual(NOV)
    expect(parseMonthParam('2026-13', NOV)).toEqual(NOV)
    expect(parseMonthParam('november', NOV)).toEqual(NOV)
    expect(parseMonthParam('2027-01', NOV)).toEqual(NOV)
  })

  it('shifts across year boundaries', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(compareMonths(NOV, { year: 2026, month: 12 })).toBeLessThan(0)
  })

  it('formats a title', () => {
    expect(formatMonthTitle(NOV)).toBe('November 2026')
  })
})

describe('monthDays', () => {
  it.each([
    [{ year: 2026, month: 2 }, 28],
    [{ year: 2028, month: 2 }, 29],
    [{ year: 2026, month: 4 }, 30],
    [{ year: 2026, month: 1 }, 31],
  ])('%j has %i days', (month, length) => {
    expect(monthDays(month)).toHaveLength(length)
  })

  it('marks weekends and weekday initials', () => {
    const [first, , , , , , seventh, eighth] = monthDays(NOV)
    // 2026-11-01 is a Sunday.
    expect(first).toEqual({ date: '2026-11-01', day: 1, weekdayInitial: 'S', weekend: true })
    expect(seventh).toMatchObject({ weekdayInitial: 'S', weekend: true })
    expect(eighth).toMatchObject({ weekdayInitial: 'S', weekend: true })
    expect(monthDays(NOV)[1]).toMatchObject({ weekdayInitial: 'M', weekend: false })
  })
})

describe('isActiveInMonth', () => {
  const habit: Habit = {
    id: 'h',
    name: 'H',
    kind: 'BUILD',
    target: { type: 'DAILY_CHECK' },
    startDate: '2026-11-15',
  }

  it('includes habits active on any day of the month', () => {
    expect(isActiveInMonth(habit, '2026-11-01', '2026-11-30')).toBe(true)
    expect(isActiveInMonth(habit, '2026-10-01', '2026-10-31')).toBe(false)
    expect(isActiveInMonth({ ...habit, archivedDate: '2026-12-01' }, '2026-12-01', '2026-12-31')).toBe(false)
    expect(isActiveInMonth({ ...habit, archivedDate: '2026-12-02' }, '2026-12-01', '2026-12-31')).toBe(true)
  })
})

describe('cellText', () => {
  const base = { id: 'h', name: 'H', kind: 'BUILD', startDate: '2026-11-01' } as const

  it('renders a mark per value type', () => {
    const check: Habit = { ...base, target: { type: 'DAILY_CHECK' } }
    const time: Habit = { ...base, target: { type: 'TARGET_TIME', goal: '05:00' } }
    expect(cellText(check, { type: 'CHECK', done: true }, 'success', '2026-11-27')).toBe('✓')
    expect(cellText(check, { type: 'CHECK', done: false }, 'fail', '2026-11-27')).toBe('')
    expect(cellText(check, { type: 'COUNT', count: 2 }, 'fail', '2026-11-27')).toBe('2')
    expect(cellText(check, { type: 'COUNT', count: 0 }, 'success', '2026-11-27')).toBe('')
    expect(cellText(time, { type: 'TIME', time: '04:48' }, 'success', '2026-11-27')).toBe('−12')
    expect(cellText(time, { type: 'TIME', time: '05:08' }, 'fail', '2026-11-27')).toBe('+8')
    expect(cellText(time, { type: 'TIME', time: '05:00' }, 'success', '2026-11-27')).toBe('0')
    expect(cellText(check, { type: 'TIME', time: '05:00' }, 'success', '2026-11-27')).toBe('')
    expect(cellText(check, { type: 'SCALE', level: 4 }, 'tracked', '2026-11-27')).toBe('4')
  })

  it('compares times with the goal for that weekday', () => {
    const bed: Habit = {
      ...base,
      target: { type: 'TARGET_TIME', goal: '22:00', goalByDay: { FRI: '23:30' } },
    }
    expect(cellText(bed, { type: 'TIME', time: '23:00' }, 'success', '2026-11-27')).toBe('−30') // Friday
    expect(cellText(bed, { type: 'TIME', time: '23:00' }, 'fail', '2026-11-26')).toBe('+60') // Thursday
  })

  it('stays empty for unlogged, future and inactive days', () => {
    const check: Habit = { ...base, target: { type: 'DAILY_CHECK' } }
    expect(cellText(check, undefined, 'fail', '2026-11-27')).toBe('')
    expect(cellText(check, { type: 'CHECK', done: true }, 'future', '2026-11-27')).toBe('')
    expect(cellText(check, { type: 'CHECK', done: true }, 'inactive', '2026-11-27')).toBe('')
  })
})

describe('describeValue', () => {
  it('describes every value type', () => {
    expect(describeValue(undefined)).toBe('nothing logged')
    expect(describeValue({ type: 'CHECK', done: true })).toBe('done')
    expect(describeValue({ type: 'CHECK', done: false })).toBe('not done')
    expect(describeValue({ type: 'COUNT', count: 2 })).toBe('count 2')
    expect(describeValue({ type: 'TIME', time: '04:48' })).toBe('at 04:48')
    expect(describeValue({ type: 'SCALE', level: 2, note: 'calm' })).toBe('level 2 (calm)')
    expect(describeValue({ type: 'SCALE', level: 2 })).toBe('level 2')
    expect(describeValue({ type: 'COUNT', count: 1, note: 'Vert Code' })).toBe('count 1 (Vert Code)')
    expect(describeValue({ type: 'TIME', time: '22:40', note: 'movie' })).toBe('at 22:40 (movie)')
  })
})
