import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { HabitRepository } from '@shared/api/habit-repository'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { TallyApi } from '@shared/api/tally-api'
import { ApiProvider } from '../api/ApiProvider'
import { AppRoutes } from '../AppRoutes'

/** Backup calls that do nothing; tests override what they need. */
const noBackup: TallyApi['backup'] = {
  export: async () => ({ saved: false }),
  pickImport: async () => null,
  confirmImport: async () => ({ safetyBackupPath: '' }),
  cancelImport: async () => undefined,
}

const noDemo: TallyApi['demo'] = {
  isEnabled: async () => false,
  setEnabled: async () => undefined,
}

/** Renders the whole app at `path` with an in-memory repository. */
export function renderApp(
  path = '/',
  repository: HabitRepository = createMemoryRepository(),
  overrides: Partial<Pick<TallyApi, 'app' | 'backup' | 'demo'>> = {},
) {
  const api: TallyApi = {
    ...repository,
    app: { getInfo: async () => ({ name: 'Tally', version: 'test', platform: 'web' }) },
    backup: noBackup,
    demo: noDemo,
    ...overrides,
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
