// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Habit, HabitLog } from '@shared/domain/habit'
import { buildTraySummary } from './tray-summary'

const TODAY = '2026-11-27' // Friday
const base = { kind: 'BUILD', startDate: '2026-11-01' } as const
const habits: Habit[] = [
  { ...base, id: 'anki', name: 'Anki', target: { type: 'DAILY_CHECK' } },
  { ...base, id: 'tv', name: 'TV', kind: 'BREAK', target: { type: 'DAILY_LIMIT', max: 1 } },
  { ...base, id: 'sweets', name: 'Sweets', kind: 'BREAK', target: { type: 'WEEKLY_LIMIT', max: 2 } },
  { ...base, id: 'wake', name: 'Wake up', target: { type: 'TARGET_TIME', goal: '05:30' } },
  { ...base, id: 'ball', name: 'Basketball', target: { type: 'WEEKLY_GOAL', min: 3 } },
  { ...base, id: 'stress', name: 'Stress', target: { type: 'DAILY_SCALE', rule: { op: 'lte', value: 2 } } },
  { ...base, id: 'mood', name: 'Mood', target: { type: 'DAILY_SCALE' } },
  { ...base, id: 'old', name: 'Old', target: { type: 'DAILY_CHECK' }, archivedDate: '2026-11-10' },
]

describe('buildTraySummary', () => {
  it('lists active habits with their status and detail', () => {
    const logs: HabitLog[] = [
      { habitId: 'anki', date: TODAY, value: { type: 'CHECK', done: true } },
      { habitId: 'tv', date: TODAY, value: { type: 'COUNT', count: 2 } },
      { habitId: 'sweets', date: '2026-11-24', value: { type: 'COUNT', count: 1 } },
      { habitId: 'wake', date: TODAY, value: { type: 'TIME', time: '05:12' } },
      { habitId: 'ball', date: '2026-11-25', value: { type: 'COUNT', count: 2 } },
      { habitId: 'mood', date: TODAY, value: { type: 'SCALE', level: 4 } },
    ]
    expect(buildTraySummary(habits, logs, TODAY).items.map((item) => item.label)).toEqual([
      '✓  Anki',
      '✗  TV (2 of 1)',
      '○  Sweets (1 of 2 this week)',
      '✓  Wake up (18 min early)',
      '○  Basketball (2 of 3 this week)',
      '○  Stress',
      '•  Mood (4)',
    ])
  })

  it('counts successes out of habits that can succeed today', () => {
    const logs: HabitLog[] = [
      { habitId: 'anki', date: TODAY, value: { type: 'CHECK', done: true } },
      { habitId: 'stress', date: TODAY, value: { type: 'SCALE', level: 2 } },
    ]
    // 7 active habits, Mood only tracks → 6 countable; Anki and Stress are done.
    const summary = buildTraySummary(habits, logs, TODAY)
    expect(summary.title).toBe('2/6')
    // Still open: TV, Sweets (limits on track), Wake up (not logged), Basketball (week open), Mood (not logged).
    expect(summary.open).toBe(5)
  })

  it('leaves out habits not scheduled today and uses the goal for today', () => {
    const scheduled: Habit[] = [
      {
        ...base,
        id: 'weekend',
        name: 'Weekend only',
        target: { type: 'DAILY_CHECK' },
        activeDays: ['SAT', 'SUN'],
      },
      {
        ...base,
        id: 'bed',
        name: 'In bed',
        target: { type: 'TARGET_TIME', goal: '22:00', goalByDay: { FRI: '23:30' } },
      },
    ]
    const logs: HabitLog[] = [{ habitId: 'bed', date: TODAY, value: { type: 'TIME', time: '23:00' } }]
    expect(buildTraySummary(scheduled, logs, TODAY).items.map((item) => item.label)).toEqual([
      '✓  In bed (30 min early)',
    ])
  })

  it('has an empty title and no items without habits', () => {
    expect(buildTraySummary([], [], TODAY)).toEqual({ title: '', items: [], open: 0 })
  })

  it('shows nothing for unlogged time and scale values', () => {
    const labels = buildTraySummary(habits, [], TODAY).items.map((item) => item.label)
    expect(labels).toContain('○  Wake up')
    expect(labels).toContain('○  Mood')
    expect(labels).toContain('○  TV (0 of 1)')
  })
})
