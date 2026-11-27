import { use } from 'react'
import { DemoContext, type DemoState } from './demo-context'

export function useDemo(): DemoState {
  const state = use(DemoContext)
  if (!state) throw new Error('useDemo must be used inside <DemoProvider>.')
  return state
}
