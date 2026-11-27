import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { Habit } from '@shared/domain/habit'
import { renderApp } from '../test/render'

const habits: Habit[] = [
  { id: 'a', name: 'Anki', kind: 'BUILD', target: { type: 'DAILY_CHECK' }, startDate: '2026-11-01' },
  {
    id: 'b',
    name: 'Bread',
    kind: 'BREAK',
    target: { type: 'WEEKLY_LIMIT', max: 1 },
    startDate: '2026-11-01',
  },
  {
    id: 'c',
    name: 'Old habit',
    kind: 'BUILD',
    target: { type: 'DAILY_CHECK' },
    startDate: '2026-10-01',
    archivedDate: '2026-11-01',
  },
]

const activeNames = () =>
  within(screen.getByRole('list', { name: 'Active habits' }))
    .getAllByRole('link', { name: /^(?!Edit)/ })
    .map((link) => link.textContent)

describe('HabitsPage', () => {
  it('shows an empty state with a link to create a habit', async () => {
    renderApp('/habits')
    expect(await screen.findByText('No habits yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create your first habit' })).toHaveAttribute(
      'href',
      '/habits/new',
    )
  })

  it('lists active habits with their kind and target, and archived ones apart', async () => {
    renderApp('/habits', createMemoryRepository({ habits }))
    const active = await screen.findByRole('list', { name: 'Active habits' })
    expect(within(active).getByText('At most 1 per week')).toBeInTheDocument()
    expect(within(active).getByText('Break')).toBeInTheDocument()
    expect(within(active).queryByText('Old habit')).not.toBeInTheDocument()
    expect(screen.getByText('Archived (1)')).toBeInTheDocument()
  })

  it('archives and unarchives a habit', async () => {
    const user = userEvent.setup()
    renderApp('/habits', createMemoryRepository({ habits }))

    await user.click(await screen.findByRole('button', { name: 'Archive Anki' }))
    expect(await screen.findByText('Archived (2)')).toBeInTheDocument()
    expect(activeNames()).toEqual(['Bread'])

    await user.click(screen.getByText('Archived (2)'))
    await user.click(screen.getByRole('button', { name: 'Unarchive Anki' }))
    expect(await screen.findByText('Archived (1)')).toBeInTheDocument()
  })

  it('reorders active habits', async () => {
    const user = userEvent.setup()
    const repository = createMemoryRepository({ habits })
    renderApp('/habits', repository)

    expect(await screen.findByRole('button', { name: 'Move Anki up' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move Anki down' }))

    await waitFor(() => expect(activeNames()).toEqual(['Bread', 'Anki']))
    expect((await repository.habits.list()).map((h) => h.id)).toEqual(['b', 'a', 'c'])
  })
})
