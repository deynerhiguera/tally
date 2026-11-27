// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isReminderDue, reminderMessage, type ReminderState } from './reminder'

const at = (hours: number, minutes: number, day = 27) => new Date(2026, 10, day, hours, minutes)
const state: ReminderState = { enabled: true, time: '21:00', lastSentOn: null }

describe('isReminderDue', () => {
  it('is due from the reminder time until an hour later', () => {
    expect(isReminderDue(at(20, 59), state)).toBe(false)
    expect(isReminderDue(at(21, 0), state)).toBe(true)
    expect(isReminderDue(at(21, 59), state)).toBe(true)
    expect(isReminderDue(at(22, 0), state)).toBe(false)
  })

  it('is never due twice on the same day', () => {
    expect(isReminderDue(at(21, 5), { ...state, lastSentOn: '2026-11-27' })).toBe(false)
    expect(isReminderDue(at(21, 5, 28), { ...state, lastSentOn: '2026-11-27' })).toBe(true)
  })

  it('is never due when disabled', () => {
    expect(isReminderDue(at(21, 0), { ...state, enabled: false })).toBe(false)
  })

  it('works for early morning times', () => {
    expect(isReminderDue(at(6, 30), { ...state, time: '06:30' })).toBe(true)
    expect(isReminderDue(at(6, 29), { ...state, time: '06:30' })).toBe(false)
  })
})

describe('reminderMessage', () => {
  it('counts open habits, and stays quiet when everything is logged', () => {
    expect(reminderMessage(4)).toBe('4 habits left to log today.')
    expect(reminderMessage(1)).toBe('1 habit left to log today.')
    expect(reminderMessage(0)).toBeNull()
  })
})
