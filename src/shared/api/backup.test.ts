import { describe, expect, it } from 'vitest'
import type { Habit, HabitLog } from '../domain/habit'
import { BACKUP_SCHEMA_VERSION, createBackup, parseBackup, summarizeBackup } from './backup'
import { InvalidInputError } from './parse'

const habits: Habit[] = [
  { id: 'a', name: 'Anki', kind: 'BUILD', target: { type: 'DAILY_CHECK' }, startDate: '2026-11-01' },
  {
    id: 'b',
    name: 'Bread',
    kind: 'BREAK',
    target: { type: 'WEEKLY_LIMIT', max: 1 },
    startDate: '2026-10-01',
    archivedDate: '2026-11-20',
  },
]
const logs: HabitLog[] = [
  { habitId: 'a', date: '2026-11-03', value: { type: 'CHECK', done: true } },
  { habitId: 'b', date: '2026-10-05', value: { type: 'COUNT', count: 2 } },
]
const backup = createBackup(habits, logs, new Date('2026-11-27T10:00:00Z'))

/** Simulates writing the file and reading it back. */
const roundTrip = (value: unknown) => parseBackup(JSON.parse(JSON.stringify(value)))

describe('createBackup', () => {
  it('stamps the format and export date', () => {
    expect(backup).toMatchObject({
      app: 'tally',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-11-27T10:00:00.000Z',
    })
  })
})

describe('parseBackup', () => {
  it('round-trips through JSON without changes', () => {
    expect(roundTrip(backup)).toEqual(backup)
  })

  it('accepts an empty backup', () => {
    expect(roundTrip(createBackup([], [])).habits).toEqual([])
  })

  it.each([
    ['not a Tally file', { hello: 'world' }, 'not a Tally backup'],
    ['a newer format', { ...backup, schemaVersion: 99 }, 'newer version of Tally'],
    ['a missing version', { ...backup, schemaVersion: '1' }, 'schema version'],
    ['a bad export date', { ...backup, exportedAt: 'yesterday' }, 'export date'],
    ['missing habits', { ...backup, habits: null }, 'habit list'],
    ['missing logs', { ...backup, logs: {} }, 'log list'],
    ['an invalid habit', { ...backup, habits: [{ ...habits[0], name: '' }] }, 'Habit 1: name is required.'],
    ['a habit that is not an object', { ...backup, habits: ['x'] }, 'Habit 1 is not an object.'],
    [
      'a bad archive date',
      { ...backup, habits: [{ ...habits[1], archivedDate: 'soon' }], logs: [] },
      'archivedDate',
    ],
    ['duplicate habits', { ...backup, habits: [habits[0], habits[0]], logs: [] }, 'same habit twice'],
    ['an orphan log', { ...backup, logs: [{ ...logs[0], habitId: 'ghost' }] }, 'not in the backup'],
    ['an invalid log', { ...backup, logs: [{ ...logs[0], date: 'nope' }] }, 'Log 1:'],
    [
      'a log of the wrong type',
      { ...backup, logs: [{ habitId: 'a', date: '2026-11-03', value: { type: 'COUNT', count: 1 } }] },
      'Log 1: A DAILY_CHECK habit needs a CHECK value',
    ],
    ['a repeated log', { ...backup, logs: [logs[0], logs[0]] }, 'repeats a habit and day'],
  ])('rejects %s', (_, value, message) => {
    expect(() => roundTrip(value)).toThrow(InvalidInputError)
    expect(() => roundTrip(value)).toThrow(message)
  })
})

describe('summarizeBackup', () => {
  it('counts habits and logs and finds the date range', () => {
    expect(summarizeBackup(backup)).toEqual({
      exportedAt: '2026-11-27T10:00:00.000Z',
      habits: 2,
      archivedHabits: 1,
      logs: 2,
      firstDate: '2026-10-05',
      lastDate: '2026-11-03',
    })
  })

  it('has no date range without logs', () => {
    expect(summarizeBackup(createBackup([], []))).toMatchObject({ firstDate: null, lastDate: null })
  })
})
