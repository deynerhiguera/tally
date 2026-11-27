import { describe, expect, it } from 'vitest'
import { meetsScaleRule, validateLogValue, validateTarget, withNote, type HabitTarget } from './habit'

describe('validateTarget', () => {
  it.each<HabitTarget>([
    { type: 'DAILY_CHECK' },
    { type: 'DAILY_LIMIT', max: 0 },
    { type: 'WEEKLY_LIMIT', max: 1 },
    { type: 'WEEKLY_GOAL', min: 3 },
    { type: 'TARGET_TIME', goal: '05:00' },
    { type: 'DAILY_SCALE' },
    { type: 'DAILY_SCALE', rule: { op: 'lte', value: 2 } },
  ])('accepts %j', (target) => {
    expect(validateTarget(target)).toEqual([])
  })

  it.each([
    { type: 'DAILY_LIMIT', max: -1 },
    { type: 'WEEKLY_LIMIT', max: 1.5 },
    { type: 'WEEKLY_GOAL', min: 0 },
    { type: 'WEEKLY_GOAL', min: 2.5 },
    { type: 'TARGET_TIME', goal: '25:00' },
    { type: 'DAILY_SCALE', rule: { op: 'lte', value: 6 } },
    { type: 'DAILY_SCALE', rule: { op: 'eq', value: 3 } },
  ] as HabitTarget[])('rejects %j', (target) => {
    expect(validateTarget(target)).toHaveLength(1)
  })
})

describe('validateLogValue', () => {
  it('accepts the value type that matches the target', () => {
    expect(validateLogValue({ type: 'DAILY_CHECK' }, { type: 'CHECK', done: true })).toEqual([])
    expect(validateLogValue({ type: 'WEEKLY_LIMIT', max: 1 }, { type: 'COUNT', count: 2 })).toEqual([])
    expect(validateLogValue({ type: 'TARGET_TIME', goal: '22:00' }, { type: 'TIME', time: '00:30' })).toEqual(
      [],
    )
    expect(validateLogValue({ type: 'DAILY_SCALE' }, { type: 'SCALE', level: 3, note: 'ok' })).toEqual([])
  })

  it('rejects a value of the wrong type', () => {
    expect(validateLogValue({ type: 'DAILY_CHECK' }, { type: 'COUNT', count: 1 })).toHaveLength(1)
  })

  it('rejects out-of-range values', () => {
    expect(validateLogValue({ type: 'DAILY_CHECK' }, { type: 'CHECK', done: 'yes' } as never)).toHaveLength(1)
    expect(validateLogValue({ type: 'DAILY_LIMIT', max: 1 }, { type: 'COUNT', count: -1 })).toHaveLength(1)
    expect(
      validateLogValue({ type: 'TARGET_TIME', goal: '22:00' }, { type: 'TIME', time: '7:00' } as never),
    ).toHaveLength(1)
    expect(validateLogValue({ type: 'DAILY_SCALE' }, { type: 'SCALE', level: 0 } as never)).toHaveLength(1)
  })
})

describe('meetsScaleRule', () => {
  it('supports at most and at least', () => {
    expect(meetsScaleRule(2, { op: 'lte', value: 2 })).toBe(true)
    expect(meetsScaleRule(3, { op: 'lte', value: 2 })).toBe(false)
    expect(meetsScaleRule(4, { op: 'gte', value: 4 })).toBe(true)
    expect(meetsScaleRule(3, { op: 'gte', value: 4 })).toBe(false)
  })
})

describe('withNote', () => {
  it('sets a trimmed note on any value type without changing the original', () => {
    const value = { type: 'COUNT' as const, count: 1 }
    expect(withNote(value, '  Vert Code day 3 ')).toEqual({
      type: 'COUNT',
      count: 1,
      note: 'Vert Code day 3',
    })
    expect(value).toEqual({ type: 'COUNT', count: 1 })
  })

  it('removes the note when it is empty', () => {
    expect(withNote({ type: 'CHECK', done: true, note: 'x' }, '   ')).toEqual({ type: 'CHECK', done: true })
    expect(withNote({ type: 'TIME', time: '05:00', note: 'x' }, undefined)).toEqual({
      type: 'TIME',
      time: '05:00',
    })
  })
})
