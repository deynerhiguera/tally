import { useState } from 'react'
import { withNote, type LogValue } from '@shared/domain/habit'

interface NoteFieldProps {
  habitName: string
  /** The value logged today; a note needs something logged first. */
  value: LogValue | undefined
  onSet(value: LogValue): void
}

/** A small "Note" button that opens an inline field. Enter or leaving the field saves; Escape cancels. */
export function NoteField({ habitName, value, onSet }: NoteFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const note = value?.note ?? ''

  function save() {
    if (draft === null || !value) return
    setDraft(null)
    if (draft.trim() !== note) onSet(withNote(value, draft))
  }

  if (draft !== null) {
    return (
      <input
        className="note"
        aria-label={`${habitName} note`}
        value={draft}
        maxLength={500}
        autoFocus
        placeholder="Add a note"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') setDraft(null)
        }}
      />
    )
  }

  return (
    <button
      type="button"
      className="note-button"
      aria-label={note ? `Edit note for ${habitName}` : `Add note for ${habitName}`}
      title={value ? undefined : 'Log something first, then add a note.'}
      disabled={!value}
      onClick={() => setDraft(note)}
    >
      {note ? 'Edit note' : 'Note'}
    </button>
  )
}
