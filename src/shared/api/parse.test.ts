import { describe, expect, it } from 'vitest'
import {
  InvalidInputError,
  parseBoolean,
  parsePreferencesChange,
  parseDate,
  parseHabitInput,
  parseHabitLog,
  parseIdList,
  parseLogValue,
} from './parse'

const validInput = {
  name: '  Wake up  ',
  kind: 'BUILD',
  target: { type: 'TARGET_TIME', goal: '05:00' },
  startDate: '2026-11-27',
}

describe('parseHabitInput', () => {
  it('returns a clean, typed input', () => {
    expect(parseHabitInput(validInput)).toEqual({ ...validInput, name: 'Wake up' })
  })

  it('drops unknown fields from the target', () => {
    const input = { ...validInput, target: { type: 'DAILY_CHECK', extra: 'x' } }
    expect(parseHabitInput(input).target).toEqual({ type: 'DAILY_CHECK' })
  })

  it('accepts every target type', () => {
    for (const target of [
      { type: 'DAILY_CHECK' },
      { type: 'DAILY_LIMIT', max: 1 },
      { type: 'WEEKLY_LIMIT', max: 0 },
      { type: 'WEEKLY_GOAL', min: 3 },
      { type: 'TARGET_TIME', goal: '22:00' },
      { type: 'DAILY_SCALE' },
      { type: 'DAILY_SCALE', rule: null },
      { type: 'DAILY_SCALE', rule: { op: 'gte', value: 4 } },
    ]) {
      expect(() => parseHabitInput({ ...validInput, target })).not.toThrow()
    }
  })

  it.each([
    ['not an object', null],
    ['empty name', { ...validInput, name: '   ' }],
    ['long name', { ...validInput, name: 'x'.repeat(81) }],
    ['bad kind', { ...validInput, kind: 'MAYBE' }],
    ['missing target', { ...validInput, target: undefined }],
    ['unknown target type', { ...validInput, target: { type: 'HOURLY' } }],
    ['negative limit', { ...validInput, target: { type: 'DAILY_LIMIT', max: -1 } }],
    ['zero weekly goal', { ...validInput, target: { type: 'WEEKLY_GOAL', min: 0 } }],
    ['bad goal', { ...validInput, target: { type: 'TARGET_TIME', goal: '5am' } }],
    ['bad scale rule', { ...validInput, target: { type: 'DAILY_SCALE', rule: 'low' } }],
    ['bad start date', { ...validInput, startDate: '2026-02-30' }],
  ])('rejects %s', (_, input) => {
    expect(() => parseHabitInput(input)).toThrow(InvalidInputError)
  })
})

describe('parseLogValue', () => {
  it('parses every value type', () => {
    expect(parseLogValue({ type: 'CHECK', done: true })).toEqual({ type: 'CHECK', done: true })
    expect(parseLogValue({ type: 'COUNT', count: 2 })).toEqual({ type: 'COUNT', count: 2 })
    expect(parseLogValue({ type: 'TIME', time: '00:30' })).toEqual({ type: 'TIME', time: '00:30' })
    expect(parseLogValue({ type: 'SCALE', level: 3, note: 'calm' })).toEqual({
      type: 'SCALE',
      level: 3,
      note: 'calm',
    })
  })

  it('drops an empty note', () => {
    expect(parseLogValue({ type: 'SCALE', level: 3, note: '' })).toEqual({ type: 'SCALE', level: 3 })
    expect(parseLogValue({ type: 'CHECK', done: true, note: '   ' })).toEqual({ type: 'CHECK', done: true })
  })

  it('keeps a trimmed note on every value type', () => {
    expect(parseLogValue({ type: 'COUNT', count: 1, note: ' Vert Code ' })).toEqual({
      type: 'COUNT',
      count: 1,
      note: 'Vert Code',
    })
    expect(parseLogValue({ type: 'CHECK', done: true, note: 'yoga' })).toMatchObject({ note: 'yoga' })
    expect(parseLogValue({ type: 'TIME', time: '22:10', note: 'movie night' })).toMatchObject({
      note: 'movie night',
    })
  })

  it.each([
    'nope',
    { type: 'CHECK', done: 'yes' },
    { type: 'COUNT', count: 1.5 },
    { type: 'COUNT', count: 1000 },
    { type: 'TIME', time: '24:00' },
    { type: 'SCALE', level: 6 },
    { type: 'SCALE', level: 3, note: 'x'.repeat(501) },
    { type: 'COUNT', count: 1, note: 42 },
    { type: 'MOOD' },
  ])('rejects %j', (value) => {
    expect(() => parseLogValue(value)).toThrow(InvalidInputError)
  })
})

describe('parseHabitLog', () => {
  it('parses a full log', () => {
    const log = { habitId: 'h1', date: '2026-11-27', value: { type: 'CHECK', done: true } }
    expect(parseHabitLog(log)).toEqual(log)
  })

  it('rejects a missing habit id or bad date', () => {
    expect(() => parseHabitLog({ date: '2026-11-27', value: { type: 'CHECK', done: true } })).toThrow()
    expect(() => parseHabitLog({ habitId: 'h1', date: 20261127, value: {} })).toThrow()
    expect(() => parseHabitLog([])).toThrow()
  })
})

describe('parseDate', () => {
  it('rejects non-dates', () => {
    expect(() => parseDate('tomorrow')).toThrow(InvalidInputError)
  })
})

describe('parseIdList', () => {
  it('accepts unique ids and rejects repeats or non-lists', () => {
    expect(parseIdList(['a', 'b'])).toEqual(['a', 'b'])
    expect(() => parseIdList(['a', 'a'])).toThrow(InvalidInputError)
    expect(() => parseIdList('a')).toThrow(InvalidInputError)
    expect(() => parseIdList([''])).toThrow(InvalidInputError)
  })
})

describe('parseBoolean', () => {
  it('accepts only booleans', () => {
    expect(parseBoolean(true, 'on')).toBe(true)
    expect(() => parseBoolean('true', 'on')).toThrow('on must be true or false.')
  })
})

describe('parsePreferencesChange', () => {
  it('accepts known preferences only', () => {
    expect(parsePreferencesChange({ showInMenuBar: false })).toEqual({ showInMenuBar: false })
    expect(parsePreferencesChange({ reminderEnabled: true, reminderTime: '21:30' })).toEqual({
      reminderEnabled: true,
      reminderTime: '21:30',
    })
    expect(() => parsePreferencesChange({ reminderTime: '9pm' })).toThrow('reminderTime must be HH:mm.')
    expect(parsePreferencesChange({})).toEqual({})
    expect(() => parsePreferencesChange({ showInMenuBar: 'no' })).toThrow(InvalidInputError)
    expect(() => parsePreferencesChange({ demoMode: true })).toThrow('not a known preference')
    expect(() => parsePreferencesChange(null)).toThrow(InvalidInputError)
  })
})
