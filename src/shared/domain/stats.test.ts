import { describe, expect, it } from 'vitest'
import type { LogValue } from './habit'
import { averageMinutesFromGoal, bestStreak, currentStreak, scaleTrend, successRate } from './stats'
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
