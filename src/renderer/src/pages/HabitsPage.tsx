import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Habit } from '@shared/domain/habit'
import { useApi } from '../api/useApi'
import { errorMessage } from '../lib/errors'
import { describeSchedule, describeTarget, KIND_LABEL } from '../lib/format'
import { today } from '../lib/today'

export function HabitsPage() {
  const api = useApi()
  const [habits, setHabits] = useState<Habit[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(
    () => api.habits.list().then(setHabits, (e: unknown) => setError(errorMessage(e))),
    [api],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    }
    await reload()
  }

  if (habits === null) return <p className="muted">Loading…</p>

  const active = habits.filter((habit) => habit.archivedDate === undefined)
  const archived = habits.filter((habit) => habit.archivedDate !== undefined)

  function move(index: number, offset: -1 | 1) {
    const order = active.map((habit) => habit.id)
    const [id] = order.splice(index, 1)
    if (id === undefined) return
    order.splice(index + offset, 0, id)
    void run(() => api.habits.reorder([...order, ...archived.map((habit) => habit.id)]))
  }

  return (
    <section>
      <header className="page-header">
        <h1>Habits</h1>
        <Link className="button primary" to="/habits/new">
          New habit
        </Link>
      </header>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {active.length === 0 ? (
        <div className="empty">
          <p>No habits yet.</p>
          <Link to="/habits/new">Create your first habit</Link>
        </div>
      ) : (
        <ul className="habit-list" aria-label="Active habits">
          {active.map((habit, index) => (
            <li key={habit.id} className="habit-row">
              <div className="habit-info">
                <Link to={`/habits/${habit.id}`} className="habit-name">
                  {habit.name}
                </Link>
                <span className={`badge badge-${habit.kind.toLowerCase()}`}>{KIND_LABEL[habit.kind]}</span>
                <span className="muted">
                  {describeTarget(habit.target)}
                  {habit.activeDays && ` · ${describeSchedule(habit.activeDays)}`}
                </span>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="icon"
                  aria-label={`Move ${habit.name} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon"
                  aria-label={`Move ${habit.name} down`}
                  disabled={index === active.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <Link className="button" to={`/habits/${habit.id}/edit`} aria-label={`Edit ${habit.name}`}>
                  Edit
                </Link>
                <button
                  type="button"
                  aria-label={`Archive ${habit.name}`}
                  onClick={() => void run(() => api.habits.archive(habit.id, today()))}
                >
                  Archive
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <details className="archived">
          <summary>Archived ({archived.length})</summary>
          <ul className="habit-list" aria-label="Archived habits">
            {archived.map((habit) => (
              <li key={habit.id} className="habit-row">
                <div className="habit-info">
                  <span className="habit-name">{habit.name}</span>
                  <span className="muted">
                    {describeTarget(habit.target)} · archived {habit.archivedDate}
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    aria-label={`Unarchive ${habit.name}`}
                    onClick={() => void run(() => api.habits.unarchive(habit.id))}
                  >
                    Unarchive
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
