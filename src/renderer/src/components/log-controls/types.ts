import type { Habit, LogValue } from '@shared/domain/habit'

export interface LogControlProps {
  habit: Habit
  /** The value logged for this habit on the selected day, if any. */
  value: LogValue | undefined
  onSet(value: LogValue): void
  onClear(): void
}
