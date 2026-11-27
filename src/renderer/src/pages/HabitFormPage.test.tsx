import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { Habit } from '@shared/domain/habit'
import { renderApp } from '../test/render'

async function fillNewHabit(name: string, target: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Name'), name)
  await user.selectOptions(screen.getByLabelText('Target'), target)
  return user
}

async function createdHabits(repository: ReturnType<typeof createMemoryRepository>) {
  await screen.findByRole('heading', { name: 'Habits' })
  return repository.habits.list()
}

describe('HabitFormPage: create', () => {
  it('creates a daily check habit and returns to the list', async () => {
    const repository = createMemoryRepository()
    renderApp('/habits/new', repository)
    const user = await fillNewHabit('Anki review', 'Daily check')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(await createdHabits(repository)).toMatchObject([
      { name: 'Anki review', kind: 'BUILD', target: { type: 'DAILY_CHECK' } },
    ])
  })

  it('creates a daily limit, defaulting the kind to Break', async () => {
    const repository = createMemoryRepository()
    renderApp('/habits/new', repository)
    const user = await fillNewHabit('Rick and Morty', 'Daily limit')

    expect(screen.getByRole('radio', { name: 'Break' })).toBeChecked()
    await user.clear(screen.getByLabelText('At most, per day'))
    await user.type(screen.getByLabelText('At most, per day'), '1')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(await createdHabits(repository)).toMatchObject([
      { kind: 'BREAK', target: { type: 'DAILY_LIMIT', max: 1 } },
    ])
  })

  it('creates a weekly limit', async () => {
    const repository = createMemoryRepository()
    renderApp('/habits/new', repository)
    const user = await fillNewHabit('Bread', 'Weekly limit')
    expect(screen.getByLabelText('At most, per week')).toHaveValue(1)
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(await createdHabits(repository)).toMatchObject([{ target: { type: 'WEEKLY_LIMIT', max: 1 } }])
  })

  it('creates a weekly goal habit as Build', async () => {
    const repository = createMemoryRepository()
    renderApp('/habits/new', repository)
    const user = await fillNewHabit('Basketball', 'Weekly goal')
    expect(screen.getByRole('radio', { name: 'Build' })).toBeChecked()
    await user.clear(screen.getByLabelText('At least, per week'))
    await user.type(screen.getByLabelText('At least, per week'), '4')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(await createdHabits(repository)).toMatchObject([
      { kind: 'BUILD', target: { type: 'WEEKLY_GOAL', min: 4 } },
    ])
  })

  it('creates a target time habit', async () => {
    const repository = createMemoryRepository()
    renderApp('/habits/new', repository)
    const user = await fillNewHabit('In bed', 'Target time')
    await user.clear(screen.getByLabelText('Goal time (at or before)'))
    await user.type(screen.getByLabelText('Goal time (at or before)'), '22:00')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(await createdHabits(repository)).toMatchObject([
      { kind: 'BUILD', target: { type: 'TARGET_TIME', goal: '22:00' } },
    ])
  })

  it('creates a scale habit with and without a rule', async () => {
    const repository = createMemoryRepository()
    const { unmount } = renderApp('/habits/new', repository)
    let user = await fillNewHabit('Mood', 'Daily scale 1–5')
    expect(screen.queryByLabelText('Level')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create habit' }))
    await screen.findByRole('heading', { name: 'Habits' })
    unmount()

    renderApp('/habits/new', repository)
    user = await fillNewHabit('Stress', 'Daily scale 1–5')
    await user.selectOptions(screen.getByLabelText('A good day is'), 'At most')
    await user.selectOptions(screen.getByLabelText('Level'), '2')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(await createdHabits(repository)).toMatchObject([
      { name: 'Mood', target: { type: 'DAILY_SCALE' } },
      { name: 'Stress', target: { type: 'DAILY_SCALE', rule: { op: 'lte', value: 2 } } },
    ])
  })

  it('shows a validation error and stays on the form', async () => {
    const repository = createMemoryRepository()
    renderApp('/habits/new', repository)
    await userEvent.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(screen.getByRole('alert')).toHaveTextContent('name is required.')
    expect(await repository.habits.list()).toEqual([])
  })

  it('rejects an empty limit', async () => {
    renderApp('/habits/new')
    const user = await fillNewHabit('Sugar', 'Daily limit')
    await user.clear(screen.getByLabelText('At most, per day'))
    await user.click(screen.getByRole('button', { name: 'Create habit' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Limit must be a whole number')
  })
})

describe('HabitFormPage: edit', () => {
  const bread: Habit = {
    id: 'b',
    name: 'Bread',
    kind: 'BREAK',
    target: { type: 'WEEKLY_LIMIT', max: 1 },
    startDate: '2026-11-01',
  }

  it('loads the habit, locks the target type and saves changes', async () => {
    const repository = createMemoryRepository({ habits: [bread] })
    renderApp('/habits/b/edit', repository)
    const user = userEvent.setup()

    const name = await screen.findByLabelText('Name')
    expect(name).toHaveValue('Bread')
    expect(screen.getByLabelText('Target')).toBeDisabled()

    await user.clear(name)
    await user.type(name, 'White bread')
    await user.clear(screen.getByLabelText('At most, per week'))
    await user.type(screen.getByLabelText('At most, per week'), '2')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await createdHabits(repository)).toMatchObject([
      { id: 'b', name: 'White bread', target: { type: 'WEEKLY_LIMIT', max: 2 } },
    ])
  })

  it('shows an error for an unknown habit', async () => {
    renderApp('/habits/ghost/edit')
    expect(await screen.findByRole('alert')).toHaveTextContent('This habit does not exist.')
  })
})
