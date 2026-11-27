// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import type { HabitInput } from '@shared/api/habit-repository'
import { InvalidInputError } from '@shared/api/parse'
import { openDatabase } from './database'
import { HabitStore } from './habit-store'

const anki: HabitInput = {
  name: 'Anki',
  kind: 'BUILD',
  target: { type: 'DAILY_CHECK' },
  startDate: '2026-11-01',
}
const bread: HabitInput = {
  name: 'Bread',
  kind: 'BREAK',
  target: { type: 'WEEKLY_LIMIT', max: 1 },
  startDate: '2026-11-01',
}

let store: HabitStore

beforeEach(() => {
  store = new HabitStore(openDatabase(':memory:'), () => new Date('2026-11-27T10:00:00Z'))
})

describe('habits', () => {
  it('creates habits with ids, in creation order', () => {
    const a = store.createHabit(anki)
    const b = store.createHabit(bread)
    expect(a).toEqual({ id: expect.any(String), ...anki })
    expect(store.listHabits().map((habit) => habit.id)).toEqual([a.id, b.id])
  })

  it('updates editable fields', () => {
    const habit = store.createHabit(bread)
    const updated = store.updateHabit(habit.id, {
      ...bread,
      name: 'White bread',
      target: { type: 'WEEKLY_LIMIT', max: 2 },
    })
    expect(updated).toMatchObject({ name: 'White bread', target: { max: 2 } })
  })

  it('refuses to change the target type', () => {
    const habit = store.createHabit(anki)
    expect(() => store.updateHabit(habit.id, { ...anki, target: { type: 'DAILY_LIMIT', max: 1 } })).toThrow(
      InvalidInputError,
    )
  })

  it('archives and unarchives without losing logs', () => {
    const habit = store.createHabit(anki)
    store.setLog({ habitId: habit.id, date: '2026-11-20', value: { type: 'CHECK', done: true } })

    expect(store.archiveHabit(habit.id, '2026-11-27').archivedDate).toBe('2026-11-27')
    expect(store.unarchiveHabit(habit.id)).not.toHaveProperty('archivedDate')
    expect(store.listLogsForHabit(habit.id)).toHaveLength(1)
  })

  it('reorders habits', () => {
    const a = store.createHabit(anki)
    const b = store.createHabit(bread)
    store.reorderHabits([b.id, a.id])
    expect(store.listHabits().map((habit) => habit.name)).toEqual(['Bread', 'Anki'])
  })

  it('refuses a reorder that misses or invents habits', () => {
    const a = store.createHabit(anki)
    store.createHabit(bread)
    expect(() => store.reorderHabits([a.id])).toThrow(InvalidInputError)
    expect(() => store.reorderHabits([a.id, 'ghost'])).toThrow(InvalidInputError)
  })

  it('reports unknown ids clearly', () => {
    expect(() => store.getHabit('ghost')).toThrow('does not exist')
    expect(() => store.archiveHabit('ghost', '2026-11-27')).toThrow(InvalidInputError)
  })
})

describe('logs', () => {
  it('creates, replaces and clears the log for one habit and day', () => {
    const habit = store.createHabit(bread)
    store.setLog({ habitId: habit.id, date: '2026-11-20', value: { type: 'COUNT', count: 1 } })
    store.setLog({ habitId: habit.id, date: '2026-11-20', value: { type: 'COUNT', count: 2 } })
    expect(store.listLogsForHabit(habit.id)).toEqual([
      { habitId: habit.id, date: '2026-11-20', value: { type: 'COUNT', count: 2 } },
    ])

    store.clearLog(habit.id, '2026-11-20')
    expect(store.listLogsForHabit(habit.id)).toEqual([])
  })

  it('rejects a value that does not match the habit target', () => {
    const habit = store.createHabit(anki)
    expect(() =>
      store.setLog({ habitId: habit.id, date: '2026-11-20', value: { type: 'COUNT', count: 1 } }),
    ).toThrow(InvalidInputError)
  })

  it('rejects logs for unknown habits', () => {
    expect(() =>
      store.setLog({ habitId: 'ghost', date: '2026-11-20', value: { type: 'CHECK', done: true } }),
    ).toThrow(InvalidInputError)
  })

  it('lists logs of every habit in an inclusive date range', () => {
    const a = store.createHabit(anki)
    const b = store.createHabit(bread)
    store.setLog({ habitId: a.id, date: '2026-10-31', value: { type: 'CHECK', done: true } })
    store.setLog({ habitId: a.id, date: '2026-11-01', value: { type: 'CHECK', done: true } })
    store.setLog({ habitId: b.id, date: '2026-11-30', value: { type: 'COUNT', count: 1 } })
    store.setLog({ habitId: b.id, date: '2026-12-01', value: { type: 'COUNT', count: 1 } })

    const november = store.listLogsInRange('2026-11-01', '2026-11-30')
    expect(november.map((log) => log.date)).toEqual(['2026-11-01', '2026-11-30'])
  })

  it('keeps notes on scale logs', () => {
    const habit = store.createHabit({ ...anki, name: 'Stress', target: { type: 'DAILY_SCALE' } })
    const value = { type: 'SCALE' as const, level: 2 as const, note: 'Calm day' }
    store.setLog({ habitId: habit.id, date: '2026-11-27', value })
    expect(store.listLogsForHabit(habit.id)[0]?.value).toEqual(value)
  })
})

describe('exportAll and replaceAll', () => {
  it('round-trips all data, keeping ids, order and archive dates', () => {
    const a = store.createHabit(anki)
    const b = store.createHabit(bread)
    store.reorderHabits([b.id, a.id])
    store.archiveHabit(b.id, '2026-11-25')
    store.setLog({ habitId: a.id, date: '2026-11-20', value: { type: 'CHECK', done: true } })
    store.setLog({ habitId: b.id, date: '2026-11-21', value: { type: 'COUNT', count: 2 } })
    const exported = store.exportAll()

    const other = new HabitStore(openDatabase(':memory:'))
    other.createHabit({ ...anki, name: 'Will be replaced' })
    other.replaceAll(exported.habits, exported.logs)

    expect(other.exportAll()).toEqual(exported)
    expect(other.listHabits().map((h) => h.name)).toEqual(['Bread', 'Anki'])
  })

  it('keeps the previous data when the replacement fails', () => {
    const a = store.createHabit(anki)
    store.setLog({ habitId: a.id, date: '2026-11-20', value: { type: 'CHECK', done: true } })
    const before = store.exportAll()

    // A log pointing at a missing habit violates the foreign key and aborts the transaction.
    expect(() =>
      store.replaceAll([], [{ habitId: 'ghost', date: '2026-11-20', value: { type: 'CHECK', done: true } }]),
    ).toThrow()
    expect(store.exportAll()).toEqual(before)
  })
})

describe('schedules', () => {
  const ritual: HabitInput = {
    name: 'Morning ritual',
    kind: 'BUILD',
    target: { type: 'TARGET_TIME', goal: '05:00' },
    startDate: '2026-11-30',
    activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  }

  it('stores active days and per-weekday goals', () => {
    const habit = store.createHabit(ritual)
    expect(habit.activeDays).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI'])

    const bed = store.createHabit({
      ...anki,
      name: 'In bed',
      target: { type: 'TARGET_TIME', goal: '22:00', goalByDay: { FRI: '23:30', SAT: '23:30' } },
    })
    expect(store.getHabit(bed.id).target).toEqual({
      type: 'TARGET_TIME',
      goal: '22:00',
      goalByDay: { FRI: '23:30', SAT: '23:30' },
    })
  })

  it('removes the schedule when an edit drops it', () => {
    const habit = store.createHabit(ritual)
    const rest: HabitInput = { ...ritual }
    delete rest.activeDays
    expect(store.updateHabit(habit.id, rest)).not.toHaveProperty('activeDays')
  })

  it('keeps schedules through export and replace', () => {
    store.createHabit(ritual)
    const exported = store.exportAll()
    const other = new HabitStore(openDatabase(':memory:'))
    other.replaceAll(exported.habits, exported.logs)
    expect(other.exportAll()).toEqual(exported)
  })
})

describe('descriptions', () => {
  it('stores, edits, removes and exports a description', () => {
    const habit = store.createHabit({ ...anki, description: '1. Rule one\n2. Rule two' })
    expect(store.getHabit(habit.id).description).toBe('1. Rule one\n2. Rule two')

    expect(store.updateHabit(habit.id, { ...anki, description: 'Focus on rule #5' }).description).toBe(
      'Focus on rule #5',
    )
    expect(store.updateHabit(habit.id, anki)).not.toHaveProperty('description')

    store.updateHabit(habit.id, { ...anki, description: 'Kept' })
    const exported = store.exportAll()
    const other = new HabitStore(openDatabase(':memory:'))
    other.replaceAll(exported.habits, exported.logs)
    expect(other.getHabit(habit.id).description).toBe('Kept')
  })
})
