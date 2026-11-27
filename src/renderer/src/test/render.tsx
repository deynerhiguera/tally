import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { HabitRepository } from '@shared/api/habit-repository'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { Preferences, TallyApi } from '@shared/api/tally-api'
import { ApiProvider } from '../api/ApiProvider'
import { DemoProvider } from '../api/DemoProvider'
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

const defaultPreferences = (): TallyApi['preferences'] => {
  let current: Preferences = { showInMenuBar: true, reminderEnabled: false, reminderTime: '21:00' }
  return {
    get: async () => current,
    update: async (change) => (current = { ...current, ...change }),
  }
}

/** Renders the whole app at `path` with an in-memory repository. */
export function renderApp(
  path = '/',
  repository: HabitRepository = createMemoryRepository(),
  overrides: Partial<Pick<TallyApi, 'app' | 'backup' | 'demo' | 'preferences'>> = {},
) {
  const api: TallyApi = {
    ...repository,
    app: { getInfo: async () => ({ name: 'Tally', version: 'test', platform: 'web' }) },
    backup: noBackup,
    demo: noDemo,
    preferences: defaultPreferences(),
    ...overrides,
  }
  const result = render(
    <ApiProvider api={api}>
      <DemoProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </DemoProvider>
    </ApiProvider>,
  )
  return { ...result, api }
}
