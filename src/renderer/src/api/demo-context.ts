import { createContext } from 'react'

export interface DemoState {
  /** Null until the first answer from the platform arrives. */
  enabled: boolean | null
  setEnabled(enabled: boolean): Promise<void>
}

export const DemoContext = createContext<DemoState | null>(null)
