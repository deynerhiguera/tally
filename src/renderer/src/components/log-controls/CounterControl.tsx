import { withNote } from '@shared/domain/habit'
import type { LogControlProps } from './types'

interface CounterControlProps extends LogControlProps {
  /** Weekly limits and goals: total for the week up to the selected day. */
  weekCount?: number
}

export function CounterControl({ habit, value, onSet, onClear, weekCount }: CounterControlProps) {
  const count = value?.type === 'COUNT' ? value.count : 0
  const target = habit.target
  // The number shown after "of": the limit, or the weekly goal.
  const max =
    target.type === 'DAILY_LIMIT' || target.type === 'WEEKLY_LIMIT'
      ? target.max
      : target.type === 'WEEKLY_GOAL'
        ? target.min
        : 0
  // Changing the count keeps the note; going back to 0 removes the log (and its note).
  const setCount = (next: number) =>
    next <= 0 ? onClear() : onSet(withNote({ type: 'COUNT', count: next }, value?.note))

  return (
    <div className="counter">
      <button
        type="button"
        className="icon"
        aria-label={`Decrease ${habit.name}`}
        disabled={count === 0}
        onClick={() => setCount(count - 1)}
      >
        −
      </button>
      <output aria-label={`${habit.name} count`} className="counter-value">
        {count}
      </output>
      <button
        type="button"
        className="icon"
        aria-label={`Increase ${habit.name}`}
        onClick={() => setCount(count + 1)}
      >
        +
      </button>
      <span className="muted">
        {weekCount === undefined ? `of ${max} today` : `${weekCount} of ${max} this week`}
      </span>
    </div>
  )
}
