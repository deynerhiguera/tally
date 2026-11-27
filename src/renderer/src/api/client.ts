import type { TallyApi } from '@shared/api/tally-api'

/**
 * The only place the UI touches the platform bridge.
 * Components import `getApi()` instead of reading `window.tally` directly,
 * so a web or mobile build can swap in another implementation here.
 */
export function getApi(): TallyApi {
  if (!window.tally) throw new Error('Tally API is not available in this environment.')
  return window.tally
}
