import type { IsoDate } from '@shared/domain/date'
import type { Habit, LogValue } from '@shared/domain/habit'

export interface LogControlProps {
  habit: Habit
  /** The day being logged (goals can differ per weekday). */
  date: IsoDate
  /** The value logged for this habit on the selected day, if any. */
  value: LogValue | undefined
  onSet(value: LogValue): void
  onClear(): void
}
