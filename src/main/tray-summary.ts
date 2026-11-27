import type { IsoDate } from '@shared/domain/date'
import { evaluateDay, indexLogs, isActiveOn, weekCountThrough, type DayStatus } from '@shared/domain/evaluate'
import type { Habit, HabitLog } from '@shared/domain/habit'
import { formatMinutesFromGoal, minutesFromGoal } from '@shared/domain/time'

export interface TrayItem {
  habitId: string
  label: string
}

export interface TraySummary {
  /** Short text next to the menu bar icon, e.g. "3/7". Empty when there are no habits. */
  title: string
  /** One line per habit active today, in display order. */
  items: TrayItem[]
}

const MARK: Record<DayStatus, string> = {
  success: '✓',
  fail: '✗',
  pending: '○',
  tracked: '•',
  untracked: '○',
  inactive: ' ',
  future: ' ',
}

function detail(habit: Habit, logs: HabitLog[], today: IsoDate): string {
  const index = indexLogs(logs)
  const value = index.get(today)
  const target = habit.target
  switch (target.type) {
    case 'DAILY_CHECK':
      return ''
    case 'DAILY_LIMIT':
      return ` (${value?.type === 'COUNT' ? value.count : 0} of ${target.max})`
    case 'WEEKLY_LIMIT':
      return ` (${weekCountThrough(index, today)} of ${target.max} this week)`
    case 'TARGET_TIME':
      return value?.type === 'TIME'
        ? ` (${formatMinutesFromGoal(minutesFromGoal(value.time, target.goal))})`
        : ''
    case 'DAILY_SCALE':
      return value?.type === 'SCALE' ? ` (${value.level})` : ''
  }
}

/**
 * What the menu bar shows for today. The title counts habits that are already a success
 * out of all habits that can succeed today (scale habits without a rule only track, so they
 * are listed but not counted). `logs` must include the current week for weekly limits.
 */
export function buildTraySummary(habits: Habit[], logs: HabitLog[], today: IsoDate): TraySummary {
  const active = habits.filter((habit) => isActiveOn(habit, today))
  let done = 0
  let countable = 0

  const items = active.map((habit) => {
    const habitLogs = logs.filter((log) => log.habitId === habit.id)
    const status = evaluateDay(habit, indexLogs(habitLogs), today, today)
    if (status !== 'tracked' && status !== 'untracked') countable++
    if (status === 'success') done++
    return { habitId: habit.id, label: `${MARK[status]}  ${habit.name}${detail(habit, habitLogs, today)}` }
  })

  return { title: countable === 0 ? '' : `${done}/${countable}`, items }
}
