import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from './AppRoutes'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('AppRoutes', () => {
  it('opens on the Today screen', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })

  it('navigates between screens from the sidebar', async () => {
    renderAt('/')
    await userEvent.click(screen.getByRole('link', { name: 'Month' }))
    expect(screen.getByRole('heading', { name: 'Month' })).toBeInTheDocument()
  })

  it('shows the habit detail route', () => {
    renderAt('/habits/abc')
    expect(screen.getByRole('heading', { name: 'Habit abc' })).toBeInTheDocument()
  })
})
