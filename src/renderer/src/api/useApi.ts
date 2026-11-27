import { use } from 'react'
import type { TallyApi } from '@shared/api/tally-api'
import { ApiContext } from './context'

export function useApi(): TallyApi {
  const api = use(ApiContext)
  if (!api) throw new Error('useApi must be used inside <ApiProvider>.')
  return api
}
