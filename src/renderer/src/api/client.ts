import type { TallyApi } from '@shared/api/tally-api'

/**
 * The only place the UI touches the platform bridge. `main.tsx` passes it to <ApiProvider>,
 * and components call `useApi()`. A web or mobile build provides another implementation.
 */
export function getApi(): TallyApi {
  if (!window.tally) throw new Error('Tally API is not available in this environment.')
  return window.tally
}
