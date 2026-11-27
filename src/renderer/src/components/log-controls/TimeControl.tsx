import { useState } from 'react'
import { formatMinutesFromGoal, isTimeOfDay, minutesFromGoal, type TimeOfDay } from '@shared/domain/time'
import type { LogControlProps } from './types'

function currentTime(): TimeOfDay {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` as TimeOfDay
}

export function TimeControl({ habit, value, onSet, onClear }: LogControlProps) {
  const saved = value?.type === 'TIME' ? value.time : ''
  const [draft, setDraft] = useState<string>(saved)
  const [lastSaved, setLastSaved] = useState<string>(saved)
  // Follow changes from outside (another day selected, data reloaded).
  if (saved !== lastSaved) {
    setLastSaved(saved)
    setDraft(saved)
  }

  const goal = habit.target.type === 'TARGET_TIME' ? habit.target.goal : undefined

  function commit(next: string) {
    if (next === saved) return
    if (next === '') onClear()
    else if (isTimeOfDay(next)) onSet({ type: 'TIME', time: next })
  }

  return (
    <div className="time-control">
      <input
        type="time"
        aria-label={`${habit.name} time`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
      />
      <button type="button" onClick={() => commit(currentTime())} aria-label={`${habit.name} now`}>
        Now
      </button>
      {saved && goal && <span className="muted">{formatMinutesFromGoal(minutesFromGoal(saved, goal))}</span>}
    </div>
  )
}
