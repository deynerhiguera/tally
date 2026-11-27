import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { IsoDate } from '@shared/domain/date'
import type { Habit, HabitLog, LogValue } from '@shared/domain/habit'
import { renderApp } from '../test/render'

// Friday 2026-11-27.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 27, 10, 0))
})
afterEach(() => vi.useRealTimers())

const base = { kind: 'BUILD', startDate: '2026-11-20' } as const
const log = (habitId: string, date: string, value: LogValue): HabitLog => ({
  habitId,
  date: date as IsoDate,
  value,
})
const done = { type: 'CHECK', done: true } as const

const stat = (label: string) => within(screen.getByLabelText('Statistics')).getByText(label).parentElement

describe('HabitDetailPage', () => {
  it('shows streaks and success rates for a daily check', async () => {
    const habit: Habit = { ...base, id: 'anki', name: 'Anki', target: { type: 'DAILY_CHECK' } }
    const logs = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-24', '2026-11-25', '2026-11-26'].map(
      (d) => log('anki', d, done),
    )
    renderApp('/habits/anki', createMemoryRepository({ habits: [habit], logs }))

    expect(await screen.findByRole('heading', { name: 'Anki' })).toBeInTheDocument()
    expect(stat('Current streak')).toHaveTextContent('3 days')
    expect(stat('Best streak')).toHaveTextContent('3 days')
    // Nov 20–26 decided (7 days), today still open.
    expect(stat('All time')).toHaveTextContent('86%6 of 7 days')
    expect(screen.queryByRole('heading', { name: 'Trend' })).not.toBeInTheDocument()
  })

  it('shows the average distance from the goal for target times', async () => {
    const habit: Habit = {
      ...base,
      id: 'wake',
      name: 'Wake up',
      target: { type: 'TARGET_TIME', goal: '05:00' },
    }
    const logs = [
      log('wake', '2026-11-25', { type: 'TIME', time: '04:50' }),
      log('wake', '2026-11-26', { type: 'TIME', time: '04:46' }),
    ]
    renderApp('/habits/wake', createMemoryRepository({ habits: [habit], logs }))
    expect(await screen.findByText('Average vs goal')).toBeInTheDocument()
    expect(stat('Average vs goal')).toHaveTextContent('12 min early')
  })

  it('shows a trend chart for scale habits and switches range', async () => {
    const habit: Habit = {
      ...base,
      id: 'stress',
      name: 'Stress',
      startDate: '2026-08-01',
      target: { type: 'DAILY_SCALE', rule: { op: 'lte', value: 2 } },
    }
    const logs = [log('stress', '2026-11-26', { type: 'SCALE', level: 2, note: 'Calm' })]
    renderApp('/habits/stress', createMemoryRepository({ habits: [habit], logs }))

    expect(await screen.findByRole('img', { name: 'Stress, 1 of 30 days logged' })).toBeInTheDocument()
    expect(screen.getByText('good if ≤ 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '90 days' }))
    expect(screen.getByRole('img', { name: 'Stress, 1 of 90 days logged' })).toBeInTheDocument()
  })

  it('shows averages instead of streaks for a scale habit without a rule', async () => {
    const habit: Habit = { ...base, id: 'mood', name: 'Mood', target: { type: 'DAILY_SCALE' } }
    const logs = [
      log('mood', '2026-11-25', { type: 'SCALE', level: 4 }),
      log('mood', '2026-11-26', { type: 'SCALE', level: 3 }),
    ]
    renderApp('/habits/mood', createMemoryRepository({ habits: [habit], logs }))
    expect(await screen.findByText('Average level')).toBeInTheDocument()
    expect(stat('Average level')).toHaveTextContent('3.5')
    expect(stat('Days logged')).toHaveTextContent('2of 8')
    expect(screen.queryByText('Current streak')).not.toBeInTheDocument()
  })

  it('lists recent days with their value and status', async () => {
    const habit: Habit = {
      ...base,
      id: 'bread',
      name: 'Bread',
      kind: 'BREAK',
      target: { type: 'WEEKLY_LIMIT', max: 1 },
    }
    const logs = [log('bread', '2026-11-24', { type: 'COUNT', count: 2 })]
    renderApp('/habits/bread', createMemoryRepository({ habits: [habit], logs }))

    const history = within(await screen.findByRole('region', { name: 'Recent days' }))
    const items = history.getAllByRole('listitem')
    expect(items).toHaveLength(8) // Nov 27 back to the start date, Nov 20
    expect(items[0]).toHaveTextContent('Friday, November 27')
    expect(items[3]).toHaveTextContent('Tuesday, November 24count 2Over limit')
    expect(history.getByRole('link', { name: 'Tuesday, November 24' })).toHaveAttribute(
      'href',
      '/?date=2026-11-24',
    )
  })

  it('freezes stats at the archive date', async () => {
    const habit: Habit = {
      ...base,
      id: 'old',
      name: 'Old',
      target: { type: 'DAILY_CHECK' },
      archivedDate: '2026-11-23',
    }
    const logs = ['2026-11-21', '2026-11-22'].map((d) => log('old', d, done))
    renderApp('/habits/old', createMemoryRepository({ habits: [habit], logs }))
    expect(await screen.findByText(/archived Monday, November 23/)).toBeInTheDocument()
    expect(stat('Current streak')).toHaveTextContent('2 days')
    expect(within(screen.getByRole('region', { name: 'Recent days' })).getAllByRole('listitem')).toHaveLength(
      3,
    )
  })

  it('handles an unknown habit', async () => {
    renderApp('/habits/ghost')
    expect(await screen.findByRole('heading', { name: 'Habit not found' })).toBeInTheDocument()
  })
})
