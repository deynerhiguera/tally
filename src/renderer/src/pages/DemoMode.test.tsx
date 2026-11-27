import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { TallyApi } from '@shared/api/tally-api'
import { renderApp } from '../test/render'

function demoApi(initial: boolean): TallyApi['demo'] & { state: { on: boolean } } {
  const state = { on: initial }
  return {
    state,
    isEnabled: vi.fn(async () => state.on),
    setEnabled: vi.fn(async (next: boolean) => {
      state.on = next
    }),
  }
}

describe('Demo mode', () => {
  it('turns on from Settings and shows a badge in the sidebar', async () => {
    const demo = demoApi(false)
    renderApp('/settings', createMemoryRepository(), { demo })
    const toggle = await screen.findByRole('switch', { name: 'Use demo data' })
    await screen.findByRole('switch', { checked: false })
    expect(screen.queryByRole('link', { name: 'Demo data' })).not.toBeInTheDocument()

    await userEvent.click(toggle)
    expect(demo.setEnabled).toHaveBeenCalledWith(true)
    expect(await screen.findByRole('switch', { checked: true })).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Demo data' }),
    ).toBeInTheDocument()
  })

  it('shows the badge on start when demo mode is already on, and turns it off', async () => {
    const demo = demoApi(true)
    renderApp('/settings', createMemoryRepository(), { demo })
    expect(await screen.findByRole('link', { name: 'Demo data' })).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('switch', { checked: true }))
    expect(demo.setEnabled).toHaveBeenCalledWith(false)
    expect(screen.queryByRole('link', { name: 'Demo data' })).not.toBeInTheDocument()
  })

  it('shows an error if switching fails', async () => {
    const demo = demoApi(false)
    demo.setEnabled = vi.fn(async () => {
      throw new Error('Disk full')
    })
    renderApp('/settings', createMemoryRepository(), { demo })
    await userEvent.click(await screen.findByRole('switch', { checked: false }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Disk full')
    expect(screen.getByRole('switch')).not.toBeChecked()
  })
})
