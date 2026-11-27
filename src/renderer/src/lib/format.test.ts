import type { HabitTarget } from '@shared/domain/habit'
import { describeTarget } from './format'

describe('describeTarget', () => {
  it.each<[HabitTarget, string]>([
    [{ type: 'DAILY_CHECK' }, 'Daily check'],
    [{ type: 'DAILY_LIMIT', max: 1 }, 'At most 1 per day'],
    [{ type: 'WEEKLY_LIMIT', max: 1 }, 'At most 1 per week'],
    [{ type: 'TARGET_TIME', goal: '05:00' }, 'By 05:00'],
    [{ type: 'DAILY_SCALE' }, 'Scale 1–5'],
    [{ type: 'DAILY_SCALE', rule: { op: 'lte', value: 2 } }, 'Scale 1–5 · good if ≤ 2'],
    [{ type: 'DAILY_SCALE', rule: { op: 'gte', value: 4 } }, 'Scale 1–5 · good if ≥ 4'],
  ])('%j → %s', (target, label) => {
    expect(describeTarget(target)).toBe(label)
  })
})
