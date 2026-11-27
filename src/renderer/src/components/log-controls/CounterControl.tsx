import type { LogControlProps } from './types'

interface CounterControlProps extends LogControlProps {
  /** Weekly limits: total for the week up to the selected day. */
  weekCount?: number
}

export function CounterControl({ habit, value, onSet, onClear, weekCount }: CounterControlProps) {
  const count = value?.type === 'COUNT' ? value.count : 0
  const max =
    habit.target.type === 'DAILY_LIMIT' || habit.target.type === 'WEEKLY_LIMIT' ? habit.target.max : 0
  const setCount = (next: number) => (next <= 0 ? onClear() : onSet({ type: 'COUNT', count: next }))

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
