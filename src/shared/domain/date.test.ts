import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysInMonth,
  eachDay,
  isWeekend,
  logicalDateOf,
  parseIsoDate,
  toIsoDate,
  weekStartOf,
} from './date'

describe('toIsoDate', () => {
  it('pads month and day', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('parseIsoDate', () => {
  it('round-trips with toIsoDate', () => {
    expect(toIsoDate(parseIsoDate('2026-11-27'))).toBe('2026-11-27')
  })

  it.each(['2026-13-01', '2026-02-30', '27/11/2026', ''])('rejects %s', (value) => {
    expect(() => parseIsoDate(value)).toThrow()
  })
})

describe('daysInMonth', () => {
  it.each([
    [2026, 1, 31],
    [2026, 2, 28],
    [2028, 2, 29],
    [2026, 4, 30],
  ])('%i-%i has %i days', (year, month, days) => {
    expect(daysInMonth(year, month)).toBe(days)
  })
})

describe('isWeekend', () => {
  it('detects Saturday and Sunday', () => {
    expect(isWeekend('2026-11-28')).toBe(true)
    expect(isWeekend('2026-11-29')).toBe(true)
  })

  it('returns false on weekdays', () => {
    expect(isWeekend('2026-11-27')).toBe(false)
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('weekStartOf', () => {
  it('returns the Monday of the week', () => {
    expect(weekStartOf('2026-11-27')).toBe('2026-11-23') // Friday
    expect(weekStartOf('2026-11-23')).toBe('2026-11-23') // Monday
    expect(weekStartOf('2026-11-29')).toBe('2026-11-23') // Sunday
  })

  it('crosses month boundaries', () => {
    expect(weekStartOf('2026-12-02')).toBe('2026-11-30')
  })
})

describe('eachDay', () => {
  it('includes both ends', () => {
    expect(eachDay('2026-11-29', '2026-12-01')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01'])
  })

  it('is empty for a reversed range', () => {
    expect(eachDay('2026-12-02', '2026-12-01')).toEqual([])
  })
})

describe('logicalDateOf', () => {
  it('keeps the calendar day from 04:00 on', () => {
    expect(logicalDateOf(new Date(2026, 10, 27, 4, 0))).toBe('2026-11-27')
    expect(logicalDateOf(new Date(2026, 10, 27, 23, 59))).toBe('2026-11-27')
  })

  it('assigns early-morning moments to the previous day', () => {
    expect(logicalDateOf(new Date(2026, 10, 27, 0, 30))).toBe('2026-11-26')
    expect(logicalDateOf(new Date(2026, 11, 1, 3, 59))).toBe('2026-11-30')
  })
})
