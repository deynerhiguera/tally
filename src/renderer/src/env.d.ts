/// <reference types="vite/client" />
import type { TallyApi } from '@shared/api/tally-api'

declare global {
  interface Window {
    /** Exposed by the Electron preload script. Undefined in tests and plain browsers. */
    tally?: TallyApi
  }
}
