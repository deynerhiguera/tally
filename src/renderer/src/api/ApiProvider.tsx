import type { ReactNode } from 'react'
import type { TallyApi } from '@shared/api/tally-api'
import { ApiContext } from './context'

/** Provides the platform API to every screen. Tests pass an in-memory implementation. */
export function ApiProvider({ api, children }: { api: TallyApi; children: ReactNode }) {
  return <ApiContext value={api}>{children}</ApiContext>
}
