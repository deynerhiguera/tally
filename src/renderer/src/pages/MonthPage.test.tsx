import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { Habit, HabitLog } from '@shared/domain/habit'
import { renderApp } from '../test/render'

// Friday 2026-11-27.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 27, 10, 0))
})
afterEach(() => vi.useRealTimers())

const base = { kind: 'BUILD', startDate: '2026-11-01' } as const
const habits: Habit[] = [
  { ...base, id: 'anki', name: 'Anki', target: { type: 'DAILY_CHECK' } },
  { ...base, id: 'bread', name: 'Bread', kind: 'BREAK', target: { type: 'WEEKLY_LIMIT', max: 1 } },
  { ...base, id: 'wake', name: 'Wake up', target: { type: 'TARGET_TIME', goal: '05:00' } },
  { ...base, id: 'new', name: 'Late starter', target: { type: 'DAILY_CHECK' }, startDate: '2026-11-20' },
  {
    ...base,
    id: 'gone',
    name: 'Old',
    target: { type: 'DAILY_CHECK' },
    startDate: '2026-09-01',
    archivedDate: '2026-10-15',
  },
]
const logs: HabitLog[] = [
  { habitId: 'anki', date: '2026-11-02', value: { type: 'CHECK', done: true } },
  { habitId: 'bread', date: '2026-10-30', value: { type: 'COUNT', count: 1 } }, // previous week, same week as Nov 1
  { habitId: 'bread', date: '2026-11-01', value: { type: 'COUNT', count: 1 } },
  { habitId: 'wake', date: '2026-11-03', value: { type: 'TIME', time: '04:48' } },
]

const cell = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}:`) })

describe('MonthPage', () => {
  it('shows a row per habit active this month and a column per day', async () => {
    renderApp('/month', createMemoryRepository({ habits, logs }))
    const table = await screen.findByRole('table', { name: 'Habits in November 2026' })
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 4)
    expect(within(table).queryByText('Old')).not.toBeInTheDocument()
    expect(within(table).getAllByRole('columnheader')).toHaveLength(1 + 30 + 1)
  })

  it('shades weekends and highlights today', async () => {
    renderApp('/month', createMemoryRepository({ habits, logs }))
    expect(await screen.findByRole('columnheader', { name: 'Sunday, November 1' })).toHaveClass('weekend')
    expect(screen.getByRole('columnheader', { name: 'Monday, November 2' })).not.toHaveClass('weekend')
    expect(screen.getByRole('columnheader', { name: 'Friday, November 27' })).toHaveClass('is-today')
  })

  it('marks each day with its status and value', async () => {
    renderApp('/month', createMemoryRepository({ habits, logs }))
    await screen.findByRole('table')

    const done = cell('Anki, Monday, November 2')
    expect(done).toHaveTextContent('✓')
    expect(done.closest('td')).toHaveClass('cell-success')
    expect(cell('Anki, Tuesday, November 3').closest('td')).toHaveClass('cell-fail')
    expect(cell('Wake up, Tuesday, November 3')).toHaveTextContent('−12')
    expect(cell('Anki, Friday, November 27').closest('td')).toHaveClass('cell-pending')
    expect(cell('Anki, Saturday, November 28')).toBeDisabled()
    expect(cell('Late starter, Monday, November 2')).toBeDisabled()
  })

  it('counts the weekly limit across the month boundary', async () => {
    renderApp('/month', createMemoryRepository({ habits, logs }))
    await screen.findByRole('table')
    expect(cell('Bread, Sunday, November 1').closest('td')).toHaveClass('cell-fail')
    expect(cell('Bread, Monday, November 2').closest('td')).toHaveClass('cell-success')
  })

  it('shows the success rate per habit', async () => {
    renderApp('/month', createMemoryRepository({ habits, logs }))
    const row = (await screen.findByRole('rowheader', { name: 'Anki' })).closest('tr') as HTMLElement
    // 1 success out of 26 decided days (Nov 1–26); today is still open.
    expect(within(row).getByText('4%')).toBeInTheDocument()
  })

  it('opens the day on the Today screen when a cell is clicked', async () => {
    renderApp('/month', createMemoryRepository({ habits, logs }))
    await screen.findByRole('table')
    await userEvent.click(cell('Anki, Tuesday, November 3'))
    expect(await screen.findByRole('heading', { name: 'Tuesday, November 3' })).toBeInTheDocument()
  })

  it('navigates months and never past the current one', async () => {
    const user = userEvent.setup()
    renderApp('/month', createMemoryRepository({ habits, logs }))
    expect(await screen.findByRole('button', { name: 'Next month' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Habits in October 2026' })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(1 + 31 + 1)
    expect(within(table).getByText('Old')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'This month' }))
    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
  })

  it('adds a header row per area', async () => {
    const withAreas: Habit[] = [
      { ...(habits[0] as Habit), area: 'ENGLISH' },
      { ...(habits[2] as Habit), area: 'SPIRIT' },
    ]
    renderApp('/month', createMemoryRepository({ habits: withAreas }))
    const table = await screen.findByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader', { name: /^(English|Spirit)$/ })
        .map((h) => h.textContent),
    ).toEqual(['English', 'Spirit'])
  })

  it('shows February with 28 days', async () => {
    renderApp(
      '/month?month=2026-02',
      createMemoryRepository({ habits: [{ ...(habits[0] as Habit), startDate: '2026-01-01' }] }),
    )
    const table = await screen.findByRole('table', { name: 'Habits in February 2026' })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(1 + 28 + 1)
  })

  it('shows an empty state for a month without habits', async () => {
    renderApp('/month?month=2026-01', createMemoryRepository({ habits }))
    expect(await screen.findByText('No habits were active this month.')).toBeInTheDocument()
  })
})
