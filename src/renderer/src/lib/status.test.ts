import type { HabitTarget } from '@shared/domain/habit'
import { statusLabel } from './status'

const check: HabitTarget = { type: 'DAILY_CHECK' }
const limit: HabitTarget = { type: 'WEEKLY_LIMIT', max: 1 }
const time: HabitTarget = { type: 'TARGET_TIME', goal: '05:00' }

describe('statusLabel', () => {
  it('words limits differently from checks', () => {
    expect(statusLabel(check, 'success')).toBe('Done')
    expect(statusLabel(limit, 'success')).toBe('Within limit')
    expect(statusLabel(check, 'pending')).toBe('To do')
    expect(statusLabel(limit, 'pending')).toBe('On track')
    expect(statusLabel(limit, 'fail')).toBe('Over limit')
    expect(statusLabel(check, 'fail')).toBe('Missed')
    expect(statusLabel(time, 'fail')).toBe('Late')
  })

  it('words weekly goals as progress toward a goal', () => {
    const goal: HabitTarget = { type: 'WEEKLY_GOAL', min: 3 }
    expect(statusLabel(goal, 'success')).toBe('Goal reached')
    expect(statusLabel(goal, 'pending')).toBe('In progress')
    expect(statusLabel(goal, 'fail')).toBe('Goal missed')
  })

  it('covers the remaining statuses', () => {
    expect(statusLabel(check, 'tracked')).toBe('Logged')
    expect(statusLabel(check, 'untracked')).toBe('Not logged')
    expect(statusLabel(check, 'inactive')).toBe('Not active')
    expect(statusLabel(check, 'future')).toBe('Upcoming')
  })
})
