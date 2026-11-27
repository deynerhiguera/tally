import { describe, expect, it } from 'vitest'
import { formatMinutesFromGoal, isOnTime, isTimeOfDay, minutesFromGoal, timeToMinutes } from './time'

describe('isTimeOfDay', () => {
  it.each(['00:00', '05:00', '23:59'])('accepts %s', (value) => {
    expect(isTimeOfDay(value)).toBe(true)
  })

  it.each(['24:00', '5:00', '05:60', '', '05:00:00'])('rejects %s', (value) => {
    expect(isTimeOfDay(value)).toBe(false)
  })
})

describe('timeToMinutes', () => {
  it('counts minutes since midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('05:30')).toBe(330)
    expect(timeToMinutes('23:59')).toBe(1439)
  })
})

describe('minutesFromGoal', () => {
  it('is negative when early and positive when late', () => {
    expect(minutesFromGoal('04:48', '05:00')).toBe(-12)
    expect(minutesFromGoal('08:10', '08:00')).toBe(10)
    expect(minutesFromGoal('05:00', '05:00')).toBe(0)
  })

  it('treats times after midnight as late for an evening goal', () => {
    expect(minutesFromGoal('00:30', '22:00')).toBe(150)
    expect(minutesFromGoal('03:59', '22:00')).toBe(359)
  })

  it('handles goals after midnight', () => {
    expect(minutesFromGoal('23:45', '00:30')).toBe(-45)
    expect(minutesFromGoal('01:00', '00:30')).toBe(30)
  })

  it('treats 04:00 as the start of a new habit day', () => {
    expect(minutesFromGoal('04:00', '05:00')).toBe(-60)
  })
})

describe('isOnTime', () => {
  it('is true at or before the goal', () => {
    expect(isOnTime('21:30', '22:00')).toBe(true)
    expect(isOnTime('22:00', '22:00')).toBe(true)
    expect(isOnTime('22:01', '22:00')).toBe(false)
    expect(isOnTime('00:15', '22:00')).toBe(false)
  })
})

describe('formatMinutesFromGoal', () => {
  it.each([
    [0, 'on time'],
    [-12, '12 min early'],
    [8, '8 min late'],
    [60, '1 h late'],
    [-65, '1 h 5 min early'],
    [150, '2 h 30 min late'],
  ])('%i → %s', (delta, label) => {
    expect(formatMinutesFromGoal(delta)).toBe(label)
  })
})
