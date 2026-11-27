import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { addDays, eachDay, type IsoDate } from '@shared/domain/date'
import { evaluateDay, indexLogs } from '@shared/domain/evaluate'
import type { Habit, HabitLog } from '@shared/domain/habit'
import {
  averageMinutesFromGoal,
  bestStreak,
  currentStreak,
  scaleTrend,
  streakUnit,
  successRate,
  type StreakUnit,
} from '@shared/domain/stats'
import { formatMinutesFromGoal } from '@shared/domain/time'
import { useApi } from '../api/useApi'
import { StatusPill } from '../components/StatusPill'
import { TrendChart } from '../components/TrendChart'
import { errorMessage } from '../lib/errors'
import { AREA_LABEL, describeSchedule, describeTarget, formatDayTitle, KIND_LABEL } from '../lib/format'
import { describeValue } from '../lib/month'
import { today } from '../lib/today'

const RANGES = [30, 90] as const
type Range = (typeof RANGES)[number]
const HISTORY_DAYS = 14

function percent(rate: number | null): string {
  return rate === null ? '–' : `${Math.round(rate * 100)}%`
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {detail && <span className="muted stat-detail">{detail}</span>}
    </div>
  )
}

const plural = (n: number, unit: StreakUnit) => `${n} ${unit}${n === 1 ? '' : 's'}`

export function HabitDetailPage() {
  const { habitId } = useParams()
  const api = useApi()
  const [habit, setHabit] = useState<Habit | null | undefined>(undefined)
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>(30)

  useEffect(() => {
    if (!habitId) return
    let active = true
    Promise.all([api.habits.list(), api.logs.listForHabit(habitId)]).then(
      ([habits, habitLogs]) => {
        if (!active) return
        setHabit(habits.find((h) => h.id === habitId) ?? null)
        setLogs(habitLogs)
      },
      (e: unknown) => active && setError(errorMessage(e)),
    )
    return () => {
      active = false
    }
  }, [api, habitId])

  if (error) {
    return (
      <p role="alert" className="error">
        {error}
      </p>
    )
  }
  if (habit === undefined) return <p className="muted">Loading…</p>
  if (habit === null) {
    return (
      <section>
        <h1>Habit not found</h1>
        <Link to="/habits">Back to habits</Link>
      </section>
    )
  }

  const current = today()
  // Archived habits stop at the day before archiving.
  const end: IsoDate =
    habit.archivedDate !== undefined && habit.archivedDate <= current
      ? addDays(habit.archivedDate, -1)
      : current
  const index = indexLogs(logs)
  const last30 = addDays(end, -29)
  const target = habit.target
  const tracksOnly = target.type === 'DAILY_SCALE' && !target.rule

  const unit = streakUnit(habit)
  const recent30 = successRate(habit, index, last30, end, current)
  const allTime = successRate(habit, index, habit.startDate, end, current)
  const averageDelta = averageMinutesFromGoal(habit, index, last30, end)

  const trendFrom = addDays(end, -(range - 1))
  const trend = scaleTrend(index, trendFrom < habit.startDate ? habit.startDate : trendFrom, end)
  const notes = new Map(
    logs.flatMap((log) => (log.value.type === 'SCALE' && log.value.note ? [[log.date, log.value.note]] : [])),
  )
  const loggedLevels = trend.flatMap((p) => (p.level === null ? [] : [p.level]))
  const averageLevel =
    loggedLevels.length === 0
      ? null
      : loggedLevels.reduce((sum, level) => sum + level, 0) / loggedLevels.length

  const historyFrom = addDays(end, -(HISTORY_DAYS - 1))
  const history = eachDay(historyFrom < habit.startDate ? habit.startDate : historyFrom, end).reverse()

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>{habit.name}</h1>
          <p className="muted subtitle">
            <span className={`badge badge-${habit.kind.toLowerCase()}`}>{KIND_LABEL[habit.kind]}</span>{' '}
            {habit.area && <span className="area-tag">{AREA_LABEL[habit.area]}</span>}{' '}
            {describeTarget(target)} · {describeSchedule(habit.activeDays)} · since{' '}
            {formatDayTitle(habit.startDate)}
            {habit.archivedDate !== undefined && ` · archived ${formatDayTitle(habit.archivedDate)}`}
          </p>
        </div>
        <Link className="button" to={`/habits/${habit.id}/edit`}>
          Edit
        </Link>
      </header>

      {habit.description && (
        <section className="panel description" aria-label="Description">
          <p>{habit.description}</p>
        </section>
      )}

      <div className="stats" aria-label="Statistics">
        {tracksOnly ? (
          <>
            <Stat
              label="Average level"
              value={averageLevel === null ? '–' : averageLevel.toFixed(1)}
              detail={`last ${range} days`}
            />
            <Stat label="Days logged" value={String(loggedLevels.length)} detail={`of ${trend.length}`} />
          </>
        ) : (
          <>
            <Stat label="Current streak" value={plural(currentStreak(habit, index, current), unit)} />
            <Stat label="Best streak" value={plural(bestStreak(habit, index, current), unit)} />
            <Stat
              label="Last 30 days"
              value={percent(recent30.rate)}
              detail={`${recent30.successes} of ${plural(recent30.scored, unit)}`}
            />
            <Stat
              label="All time"
              value={percent(allTime.rate)}
              detail={`${allTime.successes} of ${plural(allTime.scored, unit)}`}
            />
          </>
        )}
        {target.type === 'TARGET_TIME' && (
          <Stat
            label="Average vs goal"
            value={averageDelta === null ? '–' : formatMinutesFromGoal(averageDelta)}
            detail="last 30 days"
          />
        )}
      </div>

      {target.type === 'DAILY_SCALE' && (
        <section className="panel" aria-label="Trend">
          <div className="panel-header">
            <h2>Trend</h2>
            <div className="segmented-buttons" role="group" aria-label="Range">
              {RANGES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={range === option}
                  className={range === option ? 'on' : ''}
                  onClick={() => setRange(option)}
                >
                  {option} days
                </button>
              ))}
            </div>
          </div>
          <TrendChart title={habit.name} points={trend} rule={target.rule} notes={notes} />
        </section>
      )}

      <section className="panel" aria-label="Recent days">
        <h2>Recent days</h2>
        <ul className="history">
          {history.map((date) => {
            const status = evaluateDay(habit, index, date, current)
            return (
              <li key={date}>
                <Link to={`/?date=${date}`}>{formatDayTitle(date)}</Link>
                <span className="muted">{describeValue(index.get(date))}</span>
                <StatusPill target={target} status={status} />
              </li>
            )
          })}
        </ul>
      </section>
    </section>
  )
}
