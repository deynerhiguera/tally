import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { addDays, parseIsoDate, weekStartOf, type IsoDate } from '@shared/domain/date'
import { evaluateDay, indexLogs, isActiveOn, weekCountThrough, type DayStatus } from '@shared/domain/evaluate'
import type { Habit, HabitLog, LogValue } from '@shared/domain/habit'
import { useApi } from '../api/useApi'
import { StatusPill } from '../components/StatusPill'
import { CheckControl } from '../components/log-controls/CheckControl'
import { CounterControl } from '../components/log-controls/CounterControl'
import { ScaleControl } from '../components/log-controls/ScaleControl'
import { TimeControl } from '../components/log-controls/TimeControl'
import type { LogControlProps } from '../components/log-controls/types'
import { errorMessage } from '../lib/errors'
import { describeTarget, formatDayTitle } from '../lib/format'
import { today } from '../lib/today'

/** The `?date=` search param, if it is a valid date that is not in the future. */
function selectedDate(param: string | null, current: IsoDate): IsoDate {
  if (!param) return current
  try {
    parseIsoDate(param)
  } catch {
    return current
  }
  return param > current ? current : (param as IsoDate)
}

function LogControl({ weekCount, ...props }: LogControlProps & { weekCount: number }) {
  switch (props.habit.target.type) {
    case 'DAILY_CHECK':
      return <CheckControl {...props} />
    case 'DAILY_LIMIT':
      return <CounterControl {...props} />
    case 'WEEKLY_LIMIT':
    case 'WEEKLY_GOAL':
      return <CounterControl {...props} weekCount={weekCount} />
    case 'TARGET_TIME':
      return <TimeControl {...props} />
    case 'DAILY_SCALE':
      return <ScaleControl {...props} />
  }
}

interface Row {
  habit: Habit
  value: LogValue | undefined
  status: DayStatus
  weekCount: number
}

/** Log every habit for one day (today by default; `?date=YYYY-MM-DD` for past days). */
export function TodayPage() {
  const api = useApi()
  const [params, setParams] = useSearchParams()
  const current = today()
  const date = selectedDate(params.get('date'), current)
  const weekStart = weekStartOf(date)
  const [habits, setHabits] = useState<Habit[] | null>(null)
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [error, setError] = useState<string | null>(null)

  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([api.habits.list(), api.logs.listRange(weekStart, date)]).then(
      ([nextHabits, nextLogs]) => {
        if (!active) return
        setHabits(nextHabits)
        setLogs(nextLogs)
      },
      (e: unknown) => active && setError(errorMessage(e)),
    )
    return () => {
      active = false
    }
  }, [api, weekStart, date, refresh])

  async function write(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    }
    setRefresh((n) => n + 1)
  }

  const goTo = (next: IsoDate) => setParams(next === current ? {} : { date: next })

  const rows: Row[] = (habits ?? [])
    .filter((habit) => isActiveOn(habit, date))
    .map((habit) => {
      const index = indexLogs(logs.filter((log) => log.habitId === habit.id))
      return {
        habit,
        value: index.get(date),
        status: evaluateDay(habit, index, date, current),
        weekCount: weekCountThrough(index, date),
      }
    })
  const count = (status: DayStatus) => rows.filter((row) => row.status === status).length

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>{date === current ? 'Today' : formatDayTitle(date)}</h1>
          <p className="muted subtitle">{date === current ? formatDayTitle(date) : 'Editing a past day'}</p>
        </div>
        <nav className="day-nav" aria-label="Day">
          <button
            type="button"
            className="icon"
            aria-label="Previous day"
            onClick={() => goTo(addDays(date, -1))}
          >
            ‹
          </button>
          {date !== current && (
            <button type="button" onClick={() => goTo(current)}>
              Back to today
            </button>
          )}
          <button
            type="button"
            className="icon"
            aria-label="Next day"
            disabled={date >= current}
            onClick={() => goTo(addDays(date, 1))}
          >
            ›
          </button>
        </nav>
      </header>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {habits === null ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="empty">
          <p>No habits to log on this day.</p>
          <Link to="/habits/new">Create a habit</Link>
        </div>
      ) : (
        <>
          <p className="summary" aria-label="Summary">
            <strong>{count('success')}</strong> done · <strong>{count('pending')}</strong> to do ·{' '}
            <strong>{count('fail')}</strong> missed
          </p>
          <ul className="today-list" aria-label="Habits for the day">
            {rows.map(({ habit, value, status, weekCount }) => (
              <li key={habit.id} className={`today-row row-${status}`}>
                <div className="today-habit">
                  <Link to={`/habits/${habit.id}`} className="habit-name">
                    {habit.name}
                  </Link>
                  <span className="muted">{describeTarget(habit.target)}</span>
                </div>
                <LogControl
                  habit={habit}
                  value={value}
                  weekCount={weekCount}
                  onSet={(next) => void write(() => api.logs.set({ habitId: habit.id, date, value: next }))}
                  onClear={() => void write(() => api.logs.clear(habit.id, date))}
                />
                <StatusPill target={habit.target} status={status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
