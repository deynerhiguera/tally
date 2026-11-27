import { describe, expect, it } from 'vitest'
import type { HabitInput } from './habit-repository'
import { createMemoryRepository } from './memory-repository'
import { InvalidInputError } from './parse'

const anki: HabitInput = {
  name: 'Anki',
  kind: 'BUILD',
  target: { type: 'DAILY_CHECK' },
  startDate: '2026-11-01',
}

describe('createMemoryRepository', () => {
  it('creates, updates, archives, unarchives and reorders habits', async () => {
    const repo = createMemoryRepository()
    const a = await repo.habits.create(anki)
    const b = await repo.habits.create({ ...anki, name: 'Mobility' })

    await repo.habits.update(a.id, { ...anki, name: 'Anki review' })
    expect((await repo.habits.archive(a.id, '2026-11-27')).archivedDate).toBe('2026-11-27')
    expect(await repo.habits.unarchive(a.id)).not.toHaveProperty('archivedDate')

    await repo.habits.reorder([b.id, a.id])
    expect((await repo.habits.list()).map((h) => h.name)).toEqual(['Mobility', 'Anki review'])
  })

  it('applies the same rules as the SQLite store', async () => {
    const repo = createMemoryRepository()
    const a = await repo.habits.create(anki)
    await expect(
      repo.habits.update(a.id, { ...anki, target: { type: 'DAILY_LIMIT', max: 1 } }),
    ).rejects.toThrow(InvalidInputError)
    await expect(repo.habits.reorder([])).rejects.toThrow(InvalidInputError)
    await expect(repo.habits.create({ ...anki, name: '' })).rejects.toThrow(InvalidInputError)
    await expect(
      repo.logs.set({ habitId: a.id, date: '2026-11-27', value: { type: 'COUNT', count: 1 } }),
    ).rejects.toThrow(InvalidInputError)
    await expect(repo.habits.archive('ghost', '2026-11-27')).rejects.toThrow('does not exist')
  })

  it('removes optional fields that an edit leaves out', async () => {
    const repo = createMemoryRepository()
    const habit = await repo.habits.create({ ...anki, activeDays: ['MON', 'FRI'] })
    await repo.habits.archive(habit.id, '2026-11-27')
    const updated = await repo.habits.update(habit.id, anki)
    expect(updated).not.toHaveProperty('activeDays')
    expect(updated.archivedDate).toBe('2026-11-27')
  })

  it('upserts, lists and clears logs', async () => {
    const repo = createMemoryRepository()
    const a = await repo.habits.create(anki)
    await repo.logs.set({ habitId: a.id, date: '2026-11-27', value: { type: 'CHECK', done: false } })
    await repo.logs.set({ habitId: a.id, date: '2026-11-27', value: { type: 'CHECK', done: true } })
    await repo.logs.set({ habitId: a.id, date: '2026-11-26', value: { type: 'CHECK', done: true } })

    expect((await repo.logs.listForHabit(a.id)).map((l) => l.date)).toEqual(['2026-11-26', '2026-11-27'])
    expect(await repo.logs.listRange('2026-11-27', '2026-11-27')).toEqual([
      { habitId: a.id, date: '2026-11-27', value: { type: 'CHECK', done: true } },
    ])

    await repo.logs.clear(a.id, '2026-11-27')
    expect(await repo.logs.listForHabit(a.id)).toHaveLength(1)
  })

  it('returns copies, so callers cannot mutate stored data', async () => {
    const repo = createMemoryRepository({ habits: [{ id: 'h1', ...anki }] })
    const habits = await repo.habits.list()
    habits.forEach((habit) => (habit.name = 'Changed'))
    expect((await repo.habits.list())[0]?.name).toBe('Anki')
  })
})
