import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { HabitRepository } from '@shared/api/habit-repository'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { TallyApi } from '@shared/api/tally-api'
import { ApiProvider } from '../api/ApiProvider'
import { AppRoutes } from '../AppRoutes'

/** Renders the whole app at `path` with an in-memory repository. */
export function renderApp(path = '/', repository: HabitRepository = createMemoryRepository()) {
  const api: TallyApi = {
    ...repository,
    app: { getInfo: async () => ({ name: 'Tally', version: 'test', platform: 'web' }) },
  }
  const result = render(
    <ApiProvider api={api}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </ApiProvider>,
  )
  return { ...result, api }
}
