import type { LogControlProps } from './types'

export function CheckControl({ habit, value, onSet, onClear }: LogControlProps) {
  const done = value?.type === 'CHECK' && value.done
  return (
    <button
      type="button"
      className={`check ${done ? 'on' : ''}`}
      aria-pressed={done}
      aria-label={`${habit.name} done`}
      onClick={() => (done ? onClear() : onSet({ type: 'CHECK', done: true }))}
    >
      {done ? '✓ Done' : 'Mark done'}
    </button>
  )
}
