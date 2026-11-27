import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { weekStartOf, type IsoDate } from '@shared/domain/date'
import { evaluateDay, indexLogs } from '@shared/domain/evaluate'
import type { Habit, HabitLog } from '@shared/domain/habit'
import { successRate } from '@shared/domain/stats'
import { useApi } from '../api/useApi'
import { errorMessage } from '../lib/errors'
import { formatDayTitle } from '../lib/format'
import {
  cellText,
  compareMonths,
  describeValue,
  formatMonthParam,
  formatMonthTitle,
  isActiveInMonth,
  monthDays,
  monthOf,
  parseMonthParam,
  shiftMonth,
  type YearMonth,
} from '../lib/month'
import { statusLabel } from '../lib/status'
import { today } from '../lib/today'

/** Poster-style grid: one row per habit, one column per day of the month. */
export function MonthPage() {
  const api = useApi()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const current = today()
  const currentMonth = monthOf(current)
  const month = parseMonthParam(params.get('month'), currentMonth)
  const days = monthDays(month)
  const first = `${formatMonthParam(month)}-01` as IsoDate
  const last = days.at(-1)?.date ?? first
  // Weekly limits need the days of the first week that fall in the previous month.
  const from = weekStartOf(first)

  const [habits, setHabits] = useState<Habit[] | null>(null)
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([api.habits.list(), api.logs.listRange(from, last)]).then(
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
  }, [api, from, last])

  const goTo = (next: YearMonth) =>
    setParams(compareMonths(next, currentMonth) === 0 ? {} : { month: formatMonthParam(next) })

  const rows = (habits ?? [])
    .filter((habit) => isActiveInMonth(habit, first, last))
    .map((habit) => {
      const index = indexLogs(logs.filter((log) => log.habitId === habit.id))
      return {
        habit,
        index,
        rate: successRate(habit, index, first, last, current).rate,
      }
    })

  return (
    <section>
      <header className="page-header">
        <h1>{formatMonthTitle(month)}</h1>
        <nav className="day-nav" aria-label="Month">
          <button
            type="button"
            className="icon"
            aria-label="Previous month"
            onClick={() => goTo(shiftMonth(month, -1))}
          >
            ‹
          </button>
          {compareMonths(month, currentMonth) !== 0 && (
            <button type="button" onClick={() => goTo(currentMonth)}>
              This month
            </button>
          )}
          <button
            type="button"
            className="icon"
            aria-label="Next month"
            disabled={compareMonths(month, currentMonth) >= 0}
            onClick={() => goTo(shiftMonth(month, 1))}
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
          <p>No habits were active this month.</p>
          <Link to="/habits/new">Create a habit</Link>
        </div>
      ) : (
        <div className="grid-scroll">
          <table className="month-grid" aria-label={`Habits in ${formatMonthTitle(month)}`}>
            <thead>
              <tr>
                <th scope="col" className="habit-col">
                  Habit
                </th>
                {days.map((day) => (
                  <th
                    key={day.date}
                    scope="col"
                    className={`day-col ${day.weekend ? 'weekend' : ''} ${day.date === current ? 'is-today' : ''}`}
                    aria-label={formatDayTitle(day.date)}
                  >
                    <span className="weekday">{day.weekdayInitial}</span>
                    <span>{day.day}</span>
                  </th>
                ))}
                <th scope="col" className="rate-col">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ habit, index, rate }) => (
                <tr key={habit.id}>
                  <th scope="row" className="habit-col">
                    <Link to={`/habits/${habit.id}`} className="habit-name">
                      {habit.name}
                    </Link>
                  </th>
                  {days.map((day) => {
                    const status = evaluateDay(habit, index, day.date, current)
                    const value = index.get(day.date)
                    const label = `${habit.name}, ${formatDayTitle(day.date)}: ${statusLabel(habit.target, status)}, ${describeValue(value)}`
                    const disabled = status === 'future' || status === 'inactive'
                    return (
                      <td key={day.date} className={`cell ${day.weekend ? 'weekend' : ''} cell-${status}`}>
                        <button
                          type="button"
                          aria-label={label}
                          title={label}
                          disabled={disabled}
                          onClick={() => void navigate(`/?date=${day.date}`)}
                        >
                          {cellText(habit, value, status)}
                        </button>
                      </td>
                    )
                  })}
                  <td className="rate-col">{rate === null ? '–' : `${Math.round(rate * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="legend" aria-label="Legend">
          <li>
            <span className="swatch cell-success" /> Success
          </li>
          <li>
            <span className="swatch cell-fail" /> Missed or over limit
          </li>
          <li>
            <span className="swatch cell-pending" /> Today, still open
          </li>
          <li>
            <span className="swatch cell-tracked" /> Logged (trend only)
          </li>
        </ul>
      )}
    </section>
  )
}
