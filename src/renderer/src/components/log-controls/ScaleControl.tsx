import { useState } from 'react'
import type { ScaleLevel } from '@shared/domain/habit'
import type { LogControlProps } from './types'

const LEVELS: ScaleLevel[] = [1, 2, 3, 4, 5]

export function ScaleControl({ habit, value, onSet, onClear }: LogControlProps) {
  const level = value?.type === 'SCALE' ? value.level : undefined
  const savedNote = value?.type === 'SCALE' ? (value.note ?? '') : ''
  const [note, setNote] = useState(savedNote)
  const [lastSavedNote, setLastSavedNote] = useState(savedNote)
  if (savedNote !== lastSavedNote) {
    setLastSavedNote(savedNote)
    setNote(savedNote)
  }

  const save = (nextLevel: ScaleLevel, nextNote: string) =>
    onSet(
      nextNote.trim()
        ? { type: 'SCALE', level: nextLevel, note: nextNote.trim() }
        : { type: 'SCALE', level: nextLevel },
    )

  return (
    <div className="scale-control">
      <div className="scale" role="group" aria-label={`${habit.name} level`}>
        {LEVELS.map((option) => (
          <button
            key={option}
            type="button"
            className={option === level ? 'on' : ''}
            aria-pressed={option === level}
            aria-label={`${habit.name} level ${option}`}
            onClick={() => (option === level ? onClear() : save(option, note))}
          >
            {option}
          </button>
        ))}
      </div>
      <input
        className="note"
        aria-label={`${habit.name} note`}
        placeholder={level ? 'Add a note' : 'Pick a level first'}
        disabled={level === undefined}
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => level !== undefined && note.trim() !== savedNote && save(level, note)}
      />
    </div>
  )
}
