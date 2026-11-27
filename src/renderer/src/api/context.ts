import { createContext } from 'react'
import type { TallyApi } from '@shared/api/tally-api'

export const ApiContext = createContext<TallyApi | null>(null)
