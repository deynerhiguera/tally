import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { Preferences, TallyApi } from '@shared/api/tally-api'
import { renderApp } from '../test/render'

function preferencesApi(initial: Partial<Preferences> = {}): TallyApi['preferences'] {
  let current: Preferences = {
    showInMenuBar: true,
    reminderEnabled: false,
    reminderTime: '21:00',
    ...initial,
  }
  return {
    get: vi.fn(async () => current),
    update: vi.fn(async (change) => (current = { ...current, ...change })),
  }
}

const section = async () => within(await screen.findByRole('region', { name: 'Daily reminder' }))

describe('Settings: daily reminder', () => {
  it('turns the reminder on and enables the time field', async () => {
    const preferences = preferencesApi()
    renderApp('/settings', createMemoryRepository(), { preferences })
    const reminder = await section()
    const time = reminder.getByLabelText('Time')
    expect(time).toBeDisabled()
    expect(time).toHaveValue('21:00')

    await userEvent.click(await reminder.findByRole('switch', { name: 'Remind me', checked: false }))
    expect(preferences.update).toHaveBeenCalledWith({ reminderEnabled: true })
    expect(await reminder.findByRole('switch', { name: 'Remind me', checked: true })).toBeInTheDocument()
    expect(time).toBeEnabled()
  })

  it('saves a new time when leaving the field', async () => {
    const user = userEvent.setup()
    const preferences = preferencesApi({ reminderEnabled: true })
    renderApp('/settings', createMemoryRepository(), { preferences })
    const time = (await section()).getByLabelText('Time')
    await screen.findByRole('switch', { name: 'Remind me', checked: true })

    await user.clear(time)
    await user.type(time, '20:30')
    await user.tab()
    expect(preferences.update).toHaveBeenCalledWith({ reminderTime: '20:30' })
    expect(time).toHaveValue('20:30')
  })

  it('sends a test notification and explains what to do if it does not appear', async () => {
    const reminder = { test: vi.fn(async () => undefined) }
    renderApp('/settings', createMemoryRepository(), { preferences: preferencesApi(), reminder })
    await userEvent.click(await (await section()).findByRole('button', { name: 'Send test notification' }))
    expect(reminder.test).toHaveBeenCalled()
    expect(await screen.findByText(/System Settings → Notifications/)).toBeInTheDocument()
  })
})
