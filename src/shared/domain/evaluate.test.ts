import { describe, expect, it } from 'vitest'
import { evaluateDay, evaluateRange, weekCountThrough } from './evaluate'
import { check, count, makeHabit, makeLogs } from './test-helpers'

const TODAY = '2026-11-27' // Friday

describe('evaluateDay: common rules', () => {
  const habit = makeHabit({ type: 'DAILY_CHECK' }, { startDate: '2026-11-10', archivedDate: '2026-11-25' })

  it('marks days after today as future', () => {
    expect(evaluateDay(habit, makeLogs({}), '2026-11-28', TODAY)).toBe('future')
  })

  it('marks days before the start date as inactive', () => {
    expect(evaluateDay(habit, makeLogs({ '2026-11-09': check() }), '2026-11-09', TODAY)).toBe('inactive')
  })

  it('marks days from the archive date on as inactive', () => {
    expect(evaluateDay(habit, makeLogs({}), '2026-11-24', TODAY)).toBe('fail')
    expect(evaluateDay(habit, makeLogs({}), '2026-11-25', TODAY)).toBe('inactive')
  })
})

describe('evaluateDay: daily check', () => {
  const habit = makeHabit({ type: 'DAILY_CHECK' })

  it('succeeds when done', () => {
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': check() }), '2026-11-20', TODAY)).toBe('success')
  })

  it('fails on a past day that was not done or not logged', () => {
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': check(false) }), '2026-11-20', TODAY)).toBe('fail')
    expect(evaluateDay(habit, makeLogs({}), '2026-11-20', TODAY)).toBe('fail')
  })

  it('is pending today until done', () => {
    expect(evaluateDay(habit, makeLogs({}), TODAY, TODAY)).toBe('pending')
    expect(evaluateDay(habit, makeLogs({ [TODAY]: check() }), TODAY, TODAY)).toBe('success')
  })

  it('ignores a log of the wrong type', () => {
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': count(1) }), '2026-11-20', TODAY)).toBe('fail')
  })
})

describe('evaluateDay: daily limit', () => {
  const habit = makeHabit({ type: 'DAILY_LIMIT', max: 1 }, { kind: 'BREAK' })

  it('counts an unlogged past day as 0, a success', () => {
    expect(evaluateDay(habit, makeLogs({}), '2026-11-20', TODAY)).toBe('success')
  })

  it('succeeds at the limit and fails over it', () => {
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': count(1) }), '2026-11-20', TODAY)).toBe('success')
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': count(2) }), '2026-11-20', TODAY)).toBe('fail')
  })

  it('is pending today while within the limit, and fails at once when over', () => {
    expect(evaluateDay(habit, makeLogs({ [TODAY]: count(1) }), TODAY, TODAY)).toBe('pending')
    expect(evaluateDay(habit, makeLogs({ [TODAY]: count(2) }), TODAY, TODAY)).toBe('fail')
  })

  it('supports a zero limit', () => {
    const none = makeHabit({ type: 'DAILY_LIMIT', max: 0 })
    expect(evaluateDay(none, makeLogs({ '2026-11-20': count(1) }), '2026-11-20', TODAY)).toBe('fail')
  })
})

describe('evaluateDay: weekly limit', () => {
  // Bread at most once a week. Week of Mon 2026-11-16 … Sun 2026-11-22.
  const habit = makeHabit({ type: 'WEEKLY_LIMIT', max: 1 }, { kind: 'BREAK' })
  const logs = makeLogs({ '2026-11-17': count(1), '2026-11-20': count(1) })

  it('succeeds while the week total is within the limit', () => {
    expect(evaluateDay(habit, logs, '2026-11-16', TODAY)).toBe('success')
    expect(evaluateDay(habit, logs, '2026-11-19', TODAY)).toBe('success')
  })

  it('fails from the day the limit is exceeded until the week ends', () => {
    expect(evaluateDay(habit, logs, '2026-11-20', TODAY)).toBe('fail')
    expect(evaluateDay(habit, logs, '2026-11-22', TODAY)).toBe('fail')
  })

  it('resets on Monday', () => {
    expect(evaluateDay(habit, logs, '2026-11-23', TODAY)).toBe('success')
  })

  it('sums only the current week', () => {
    expect(weekCountThrough(logs, '2026-11-22')).toBe(2)
    expect(weekCountThrough(logs, '2026-11-23')).toBe(0)
  })

  it('is pending today while within the limit', () => {
    expect(evaluateDay(habit, makeLogs({ '2026-11-24': count(1) }), TODAY, TODAY)).toBe('pending')
  })
})

describe('evaluateDay: target time', () => {
  // In bed by 22:00.
  const habit = makeHabit({ type: 'TARGET_TIME', goal: '22:00' })
  const time = (t: `${number}:${number}`) => ({ type: 'TIME' as const, time: t })

  it('succeeds at or before the goal', () => {
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': time('21:45') }), '2026-11-20', TODAY)).toBe('success')
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': time('22:00') }), '2026-11-20', TODAY)).toBe('success')
  })

  it('fails when late, including after midnight', () => {
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': time('22:20') }), '2026-11-20', TODAY)).toBe('fail')
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': time('00:30') }), '2026-11-20', TODAY)).toBe('fail')
  })

  it('misses an unlogged past day and is pending today', () => {
    expect(evaluateDay(habit, makeLogs({}), '2026-11-20', TODAY)).toBe('fail')
    expect(evaluateDay(habit, makeLogs({}), TODAY, TODAY)).toBe('pending')
  })
})

describe('evaluateDay: daily scale', () => {
  const scale = (level: 1 | 2 | 3 | 4 | 5) => ({ type: 'SCALE' as const, level })

  it('only tracks when there is no rule', () => {
    const habit = makeHabit({ type: 'DAILY_SCALE' })
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': scale(4) }), '2026-11-20', TODAY)).toBe('tracked')
    expect(evaluateDay(habit, makeLogs({}), '2026-11-20', TODAY)).toBe('untracked')
  })

  it('applies the rule when there is one', () => {
    // Stress: a good day is 2 or less.
    const habit = makeHabit({ type: 'DAILY_SCALE', rule: { op: 'lte', value: 2 } })
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': scale(2) }), '2026-11-20', TODAY)).toBe('success')
    expect(evaluateDay(habit, makeLogs({ '2026-11-20': scale(3) }), '2026-11-20', TODAY)).toBe('fail')
    expect(evaluateDay(habit, makeLogs({}), '2026-11-20', TODAY)).toBe('fail')
    expect(evaluateDay(habit, makeLogs({}), TODAY, TODAY)).toBe('pending')
  })
})

describe('evaluateRange', () => {
  it('returns a status for every day, crossing a month boundary', () => {
    const habit = makeHabit({ type: 'DAILY_CHECK' })
    const range = evaluateRange(
      habit,
      makeLogs({ '2026-11-30': check() }),
      '2026-11-29',
      '2026-12-01',
      '2026-12-01',
    )
    expect([...range]).toEqual([
      ['2026-11-29', 'fail'],
      ['2026-11-30', 'success'],
      ['2026-12-01', 'pending'],
    ])
  })
})
