import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { Habit, HabitLog } from '@shared/domain/habit'
import { renderApp } from '../test/render'

// Friday 2026-11-27, 10:00.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 27, 10, 0))
})
afterEach(() => vi.useRealTimers())

const base = { kind: 'BUILD', startDate: '2026-11-01' } as const
const habits: Habit[] = [
  { ...base, id: 'anki', name: 'Anki', target: { type: 'DAILY_CHECK' } },
  { ...base, id: 'rick', name: 'Rick and Morty', kind: 'BREAK', target: { type: 'DAILY_LIMIT', max: 1 } },
  { ...base, id: 'bread', name: 'Bread', kind: 'BREAK', target: { type: 'WEEKLY_LIMIT', max: 1 } },
  { ...base, id: 'wake', name: 'Wake up', target: { type: 'TARGET_TIME', goal: '05:00' } },
  { ...base, id: 'stress', name: 'Stress', target: { type: 'DAILY_SCALE', rule: { op: 'lte', value: 2 } } },
  { ...base, id: 'old', name: 'Old', target: { type: 'DAILY_CHECK' }, archivedDate: '2026-11-10' },
]

function row(name: string) {
  return screen.getByText(name, { selector: '.habit-name' }).closest('li') as HTMLElement
}

describe('TodayPage', () => {
  it('lists active habits for today with a summary', async () => {
    renderApp('/', createMemoryRepository({ habits }))
    expect(await screen.findByText('Friday, November 27')).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Habits for the day' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(within(list).queryByText('Old')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Summary')).toHaveTextContent('0 done · 5 to do · 0 missed')
  })

  it('logs a check and updates the status', async () => {
    const repository = createMemoryRepository({ habits })
    renderApp('/', repository)
    await userEvent.click(await screen.findByRole('button', { name: 'Anki done' }))

    expect(await within(row('Anki')).findByText('Done')).toBeInTheDocument()
    expect(await repository.logs.listForHabit('anki')).toEqual([
      { habitId: 'anki', date: '2026-11-27', value: { type: 'CHECK', done: true } },
    ])
  })

  it('fails a daily limit as soon as it is exceeded', async () => {
    renderApp('/', createMemoryRepository({ habits }))
    const increase = await screen.findByRole('button', { name: 'Increase Rick and Morty' })
    await userEvent.click(increase)
    expect(await within(row('Rick and Morty')).findByText('On track')).toBeInTheDocument()
    await userEvent.click(increase)
    expect(await within(row('Rick and Morty')).findByText('Over limit')).toBeInTheDocument()
  })

  it('counts the whole week for weekly limits', async () => {
    const logs: HabitLog[] = [{ habitId: 'bread', date: '2026-11-24', value: { type: 'COUNT', count: 1 } }]
    renderApp('/', createMemoryRepository({ habits, logs }))
    expect(await screen.findByText('1 of 1 this week')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Increase Bread' }))
    expect(await screen.findByText('2 of 1 this week')).toBeInTheDocument()
    expect(within(row('Bread')).getByText('Over limit')).toBeInTheDocument()
  })

  it('logs a time and shows how early it was', async () => {
    const user = userEvent.setup()
    renderApp('/', createMemoryRepository({ habits }))
    await user.type(await screen.findByLabelText('Wake up time'), '04:48')
    await user.tab()
    expect(await screen.findByText('12 min early')).toBeInTheDocument()
    expect(within(row('Wake up')).getByText('Done')).toBeInTheDocument()
  })

  it('logs a scale level against its rule', async () => {
    renderApp('/', createMemoryRepository({ habits }))
    await userEvent.click(await screen.findByRole('button', { name: 'Stress level 4' }))
    expect(await within(row('Stress')).findByText('Missed')).toBeInTheDocument()
  })

  it('edits a past day and never goes into the future', async () => {
    const user = userEvent.setup()
    const repository = createMemoryRepository({ habits })
    renderApp('/', repository)
    expect(await screen.findByRole('button', { name: 'Next day' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(await screen.findByRole('heading', { name: 'Thursday, November 26' })).toBeInTheDocument()
    expect(screen.getByLabelText('Summary')).toHaveTextContent('2 done · 0 to do · 3 missed')

    await user.click(screen.getByRole('button', { name: 'Anki done' }))
    expect(await repository.logs.listForHabit('anki')).toMatchObject([{ date: '2026-11-26' }])

    await user.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })

  it('adds a note to a count and shows it on the row', async () => {
    const user = userEvent.setup()
    const repository = createMemoryRepository({ habits })
    renderApp('/', repository)
    await user.click(await screen.findByRole('button', { name: 'Increase Rick and Morty' }))
    await user.click(await screen.findByRole('button', { name: 'Add note for Rick and Morty' }))
    await user.type(screen.getByLabelText('Rick and Morty note'), 'Season finale{Enter}')

    expect(await within(row('Rick and Morty')).findByText('“Season finale”')).toBeInTheDocument()
    expect(await repository.logs.listForHabit('rick')).toEqual([
      { habitId: 'rick', date: '2026-11-27', value: { type: 'COUNT', count: 1, note: 'Season finale' } },
    ])
  })

  it('ignores a future or invalid date in the URL', async () => {
    renderApp('/?date=2027-01-01', createMemoryRepository({ habits }))
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })

  it('shows an empty state without habits', async () => {
    renderApp('/')
    expect(await screen.findByText('No habits to log on this day.')).toBeInTheDocument()
  })
})
