import { describe, expect, it } from 'vitest'
import type { LogValue } from './habit'
import {
  averageMinutesFromGoal,
  bestStreak,
  currentStreak,
  scaleTrend,
  streakUnit,
  successRate,
} from './stats'
import { check, count, makeHabit, makeLogs } from './test-helpers'

const TODAY = '2026-11-27'
const checkHabit = makeHabit({ type: 'DAILY_CHECK' }, { startDate: '2026-11-20' })

describe('currentStreak', () => {
  it('counts consecutive successes ending yesterday when today is pending', () => {
    const logs = makeLogs({ '2026-11-24': check(), '2026-11-25': check(), '2026-11-26': check() })
    expect(currentStreak(checkHabit, logs, TODAY)).toBe(3)
  })

  it('includes today once it succeeds', () => {
    const logs = makeLogs({ '2026-11-26': check(), [TODAY]: check() })
    expect(currentStreak(checkHabit, logs, TODAY)).toBe(2)
  })

  it('is 0 after a missed day', () => {
    const logs = makeLogs({ '2026-11-25': check() })
    expect(currentStreak(checkHabit, logs, TODAY)).toBe(0)
  })

  it('stops at the start date', () => {
    const habit = makeHabit({ type: 'DAILY_CHECK' }, { startDate: '2026-11-26' })
    expect(currentStreak(habit, makeLogs({ '2026-11-26': check(), [TODAY]: check() }), TODAY)).toBe(2)
  })

  it('counts every unlogged past day of a BREAK limit as a success', () => {
    const habit = makeHabit({ type: 'DAILY_LIMIT', max: 1 }, { kind: 'BREAK', startDate: '2026-11-20' })
    expect(currentStreak(habit, makeLogs({}), TODAY)).toBe(7)
    expect(currentStreak(habit, makeLogs({ '2026-11-24': count(3) }), TODAY)).toBe(2)
  })

  it('breaks immediately when a limit is exceeded today', () => {
    const habit = makeHabit({ type: 'DAILY_LIMIT', max: 1 }, { startDate: '2026-11-20' })
    expect(currentStreak(habit, makeLogs({ [TODAY]: count(2) }), TODAY)).toBe(0)
  })

  it('freezes at the archive date', () => {
    const habit = makeHabit({ type: 'DAILY_CHECK' }, { startDate: '2026-11-20', archivedDate: '2026-11-23' })
    const logs = makeLogs({ '2026-11-21': check(), '2026-11-22': check() })
    expect(currentStreak(habit, logs, TODAY)).toBe(2)
  })

  it('is 0 for a scale habit without a rule', () => {
    const habit = makeHabit({ type: 'DAILY_SCALE' }, { startDate: '2026-11-20' })
    const logs = makeLogs({ '2026-11-26': { type: 'SCALE', level: 3 } })
    expect(currentStreak(habit, logs, TODAY)).toBe(0)
  })
})

describe('bestStreak', () => {
  it('finds the longest run', () => {
    const logs = makeLogs({
      '2026-11-20': check(),
      '2026-11-21': check(),
      '2026-11-22': check(),
      '2026-11-24': check(),
      '2026-11-25': check(),
    })
    expect(bestStreak(checkHabit, logs, TODAY)).toBe(3)
  })

  it('is 0 with no successes', () => {
    expect(bestStreak(checkHabit, makeLogs({}), TODAY)).toBe(0)
  })

  it('counts today once it succeeds', () => {
    const habit = makeHabit({ type: 'DAILY_CHECK' }, { startDate: '2026-11-26' })
    expect(bestStreak(habit, makeLogs({ '2026-11-26': check(), [TODAY]: check() }), TODAY)).toBe(2)
  })
})

describe('successRate', () => {
  it('divides successes by decided days, leaving out pending today', () => {
    const logs = makeLogs({ '2026-11-24': check(), '2026-11-25': check(), '2026-11-26': check() })
    expect(successRate(checkHabit, logs, '2026-11-20', TODAY, TODAY)).toEqual({
      successes: 3,
      scored: 7,
      rate: 3 / 7,
      unit: 'day',
    })
  })

  it('leaves out inactive and future days', () => {
    const logs = makeLogs({ '2026-11-20': check() })
    expect(successRate(checkHabit, logs, '2026-11-01', '2026-11-30', '2026-11-22').scored).toBe(2)
  })

  it('returns a null rate when nothing was decided', () => {
    expect(successRate(checkHabit, makeLogs({}), TODAY, TODAY, TODAY)).toEqual({
      successes: 0,
      scored: 0,
      rate: null,
      unit: 'day',
    })
  })
})

describe('averageMinutesFromGoal', () => {
  const habit = makeHabit({ type: 'TARGET_TIME', goal: '05:00' })
  const time = (t: `${number}:${number}`): LogValue => ({ type: 'TIME', time: t })

  it('averages logged days only', () => {
    const logs = makeLogs({ '2026-11-24': time('04:50'), '2026-11-25': time('05:20') })
    expect(averageMinutesFromGoal(habit, logs, '2026-11-20', TODAY)).toBe(5)
  })

  it('returns null without logs or for other target types', () => {
    expect(averageMinutesFromGoal(habit, makeLogs({}), '2026-11-20', TODAY)).toBeNull()
    expect(averageMinutesFromGoal(checkHabit, makeLogs({}), '2026-11-20', TODAY)).toBeNull()
  })
})

describe('scaleTrend', () => {
  it('returns one point per day with gaps as null', () => {
    const logs = makeLogs({ '2026-11-25': { type: 'SCALE', level: 4, note: 'busy' } })
    expect(scaleTrend(logs, '2026-11-25', '2026-11-26')).toEqual([
      { date: '2026-11-25', level: 4 },
      { date: '2026-11-26', level: null },
    ])
  })
})

describe('weekly goal stats (counted in weeks)', () => {
  // Basketball at least 3 a week. Weeks: Nov 2–8, 9–15, 16–22, and the current week Nov 23–29.
  const habit = makeHabit({ type: 'WEEKLY_GOAL', min: 3 }, { startDate: '2026-11-02' })
  const logs = makeLogs({
    '2026-11-03': count(3), // week 1: reached
    '2026-11-10': count(1), // week 2: missed (1)
    '2026-11-17': count(2), //
    '2026-11-19': count(1), // week 3: reached (3)
    '2026-11-24': count(1), // current week: 1 so far
  })

  it('uses weeks as the unit', () => {
    expect(streakUnit(habit)).toBe('week')
    expect(streakUnit(checkHabit)).toBe('day')
  })

  it('counts the current streak in weeks and keeps it alive during an open week', () => {
    expect(currentStreak(habit, logs, TODAY)).toBe(1)
  })

  it('adds the current week once its goal is reached', () => {
    const reached = makeLogs({ '2026-11-17': count(3), '2026-11-24': count(3) })
    expect(currentStreak(habit, reached, TODAY)).toBe(2)
    expect(bestStreak(habit, reached, TODAY)).toBe(2)
  })

  it('finds the best streak in weeks', () => {
    expect(bestStreak(habit, logs, TODAY)).toBe(1)
  })

  it('computes the success rate over decided weeks', () => {
    expect(successRate(habit, logs, '2026-11-02', TODAY, TODAY)).toEqual({
      successes: 2,
      scored: 3,
      rate: 2 / 3,
      unit: 'week',
    })
  })

  it('scores a week that starts before the range by its last day in the range', () => {
    // From Nov 5 (a Thursday): week 1 still counts once.
    expect(successRate(habit, logs, '2026-11-05', '2026-11-15', TODAY)).toMatchObject({
      successes: 1,
      scored: 2,
    })
  })
})

describe('stats with a schedule', () => {
  // Mon–Fri only. Week of Mon Nov 16 … Sun Nov 22, then Mon Nov 23 … today Fri Nov 27.
  const weekdays = makeHabit(
    { type: 'DAILY_CHECK' },
    { startDate: '2026-11-16', activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  )
  const allWeekdays = makeLogs(
    Object.fromEntries(
      ['16', '17', '18', '19', '20', '23', '24', '25', '26'].map((d) => [`2026-11-${d}`, check()]),
    ),
  )

  it('skips days off instead of breaking the streak', () => {
    expect(currentStreak(weekdays, allWeekdays, TODAY)).toBe(9)
    expect(bestStreak(weekdays, allWeekdays, TODAY)).toBe(9)
  })

  it('leaves days off out of the success rate', () => {
    expect(successRate(weekdays, allWeekdays, '2026-11-16', TODAY, TODAY)).toMatchObject({
      successes: 9,
      scored: 9,
    })
  })

  it("averages a target time against each day's goal", () => {
    const bed = makeHabit({ type: 'TARGET_TIME', goal: '22:00', goalByDay: { FRI: '23:30' } })
    const logs = makeLogs({
      '2026-11-26': { type: 'TIME', time: '22:10' }, // Thursday: +10
      '2026-11-27': { type: 'TIME', time: '23:20' }, // Friday: −10
    })
    expect(averageMinutesFromGoal(bed, logs, '2026-11-26', TODAY)).toBe(0)
  })
})
