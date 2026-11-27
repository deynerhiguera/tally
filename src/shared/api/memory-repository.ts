import type { IsoDate } from '../domain/date'
import { validateLogValue, type Habit, type HabitLog } from '../domain/habit'
import type { HabitInput, HabitRepository } from './habit-repository'
import { InvalidInputError, parseHabitInput, parseHabitLog } from './parse'

/**
 * In-memory `HabitRepository` with the same rules as the SQLite store.
 * Used by UI tests today; a browser build could use it as a starting point.
 */
export function createMemoryRepository(seed: { habits?: Habit[]; logs?: HabitLog[] } = {}): HabitRepository {
  let habits: Habit[] = structuredClone(seed.habits ?? [])
  let logs: HabitLog[] = structuredClone(seed.logs ?? [])
  let nextId = habits.length + 1

  const copy = <T>(value: T): Promise<T> => Promise.resolve(structuredClone(value))

  function find(id: string): Habit {
    const habit = habits.find((h) => h.id === id)
    if (!habit) throw new InvalidInputError(`Habit ${id} does not exist.`)
    return habit
  }

  function replace(id: string, change: (habit: Habit) => Habit): Promise<Habit> {
    const updated = change(find(id))
    habits = habits.map((h) => (h.id === id ? updated : h))
    return copy(updated)
  }

  return {
    habits: {
      list: () => copy(habits),
      async create(input: HabitInput) {
        const habit: Habit = { id: `habit-${nextId++}`, ...parseHabitInput(input) }
        habits = [...habits, habit]
        return copy(habit)
      },
      async update(id, input) {
        const parsed = parseHabitInput(input)
        return replace(id, (habit) => {
          if (habit.target.type !== parsed.target.type) {
            throw new InvalidInputError("A habit's target type can't change.")
          }
          // Rebuild from the parsed input, so optional fields removed in the edit are removed here too.
          const updated: Habit = { id: habit.id, ...parsed }
          if (habit.archivedDate !== undefined) updated.archivedDate = habit.archivedDate
          return updated
        })
      },
      archive: async (id, date: IsoDate) => replace(id, (habit) => ({ ...habit, archivedDate: date })),
      unarchive: async (id) =>
        replace(id, (habit) => {
          const rest = { ...habit }
          delete rest.archivedDate
          return rest
        }),
      async reorder(ids) {
        if (ids.length !== habits.length || !habits.every((h) => ids.includes(h.id))) {
          throw new InvalidInputError('Reorder must list every habit exactly once.')
        }
        habits = ids.map((id) => find(id))
      },
    },
    logs: {
      listRange: (from, to) => copy(logs.filter((log) => log.date >= from && log.date <= to)),
      listForHabit: (habitId) =>
        copy(logs.filter((log) => log.habitId === habitId).sort((a, b) => a.date.localeCompare(b.date))),
      async set(input) {
        const log = parseHabitLog(input)
        const problems = validateLogValue(find(log.habitId).target, log.value)
        if (problems.length > 0) throw new InvalidInputError(problems.join(' '))
        logs = [...logs.filter((l) => !(l.habitId === log.habitId && l.date === log.date)), log]
      },
      async clear(habitId, date) {
        logs = logs.filter((log) => !(log.habitId === habitId && log.date === date))
      },
    },
  }
}
