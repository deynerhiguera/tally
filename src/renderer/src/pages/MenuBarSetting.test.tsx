import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { TallyApi } from '@shared/api/tally-api'
import { renderApp } from '../test/render'

function preferencesApi(showInMenuBar: boolean): TallyApi['preferences'] {
  let current = { showInMenuBar }
  return {
    get: vi.fn(async () => current),
    update: vi.fn(async (change) => (current = { ...current, ...change })),
  }
}

describe('Settings: menu bar', () => {
  it('shows the saved preference and turns the menu bar icon off and on', async () => {
    const preferences = preferencesApi(true)
    renderApp('/settings', createMemoryRepository(), { preferences })
    const toggle = await screen.findByRole('switch', { name: 'Show in menu bar', checked: true })

    await userEvent.click(toggle)
    expect(preferences.update).toHaveBeenCalledWith({ showInMenuBar: false })
    expect(
      await screen.findByRole('switch', { name: 'Show in menu bar', checked: false }),
    ).toBeInTheDocument()

    await userEvent.click(toggle)
    expect(preferences.update).toHaveBeenLastCalledWith({ showInMenuBar: true })
  })

  it('shows an error if saving fails', async () => {
    const preferences = preferencesApi(false)
    preferences.update = vi.fn(async () => {
      throw new Error('Could not save')
    })
    renderApp('/settings', createMemoryRepository(), { preferences })
    await userEvent.click(await screen.findByRole('switch', { name: 'Show in menu bar', checked: false }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
  })
})
