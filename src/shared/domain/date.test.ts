import { describe, expect, it } from 'vitest'
import { daysInMonth, isWeekend, parseIsoDate, toIsoDate } from './date'

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
