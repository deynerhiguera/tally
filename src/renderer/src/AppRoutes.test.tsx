import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRepository } from '@shared/api/memory-repository'
import { renderApp } from './test/render'

describe('AppRoutes', () => {
  it('opens on the Today screen', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })

  it('navigates between screens from the sidebar', async () => {
    renderApp('/')
    await userEvent.click(screen.getByRole('link', { name: 'Month' }))
    expect(await screen.findByRole('button', { name: 'Previous month' })).toBeInTheDocument()
  })

  it('shows the habit detail route', async () => {
    renderApp('/habits/abc')
    expect(await screen.findByRole('heading', { name: 'Habit not found' })).toBeInTheDocument()
  })

  it('goes to the screen the platform asks for, like Today after a reminder click', async () => {
    let navigateTo: (path: string) => void = () => undefined
    renderApp('/habits', createMemoryRepository(), {
      app: {
        getInfo: async () => ({ name: 'Tally', version: 'test', platform: 'web' }),
        onNavigate: (listener) => {
          navigateTo = listener
          return () => undefined
        },
      },
    })
    expect(await screen.findByRole('heading', { name: 'Habits' })).toBeInTheDocument()

    act(() => navigateTo('https://example.com'))
    expect(screen.getByRole('heading', { name: 'Habits' })).toBeInTheDocument()

    act(() => navigateTo('/'))
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })
})
