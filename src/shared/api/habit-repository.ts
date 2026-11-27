import type { IsoDate } from '../domain/date'
import type { Habit, HabitKind, HabitLog, HabitTarget } from '../domain/habit'

/** Fields the user edits. The id and archive state are managed by the repository. */
export interface HabitInput {
  name: string
  kind: HabitKind
  target: HabitTarget
  startDate: IsoDate
}

/**
 * Storage contract the UI depends on. The Electron build implements it with SQLite in the
 * main process (reached through the preload bridge); a web or mobile build can implement it
 * with IndexedDB or a native store without touching the UI.
 */
export interface HabitRepository {
  habits: {
    /** All habits, archived included, in display order. */
    list(): Promise<Habit[]>
    create(input: HabitInput): Promise<Habit>
    /** The target type can't change once created; archive and create a new habit instead. */
    update(id: string, input: HabitInput): Promise<Habit>
    archive(id: string, date: IsoDate): Promise<Habit>
    unarchive(id: string): Promise<Habit>
    /** Sets the display order. `ids` must contain every habit exactly once. */
    reorder(ids: string[]): Promise<void>
  }
  logs: {
    /** Logs of every habit with dates from `from` to `to`, inclusive. */
    listRange(from: IsoDate, to: IsoDate): Promise<HabitLog[]>
    /** Every log of one habit, oldest first. */
    listForHabit(habitId: string): Promise<HabitLog[]>
    /** Creates or replaces the log for that habit and day. */
    set(log: HabitLog): Promise<void>
    /** Removes the log for that habit and day, if any. */
    clear(habitId: string, date: IsoDate): Promise<void>
  }
}
