import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('shows the habit detail route', () => {
    renderApp('/habits/abc')
    expect(screen.getByRole('heading', { name: 'Habit abc' })).toBeInTheDocument()
  })
})
