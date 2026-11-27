import { useEffect, useState, type ReactNode } from 'react'
import { DemoContext } from './demo-context'
import { useApi } from './useApi'

/** Shares whether demo mode is on, so the sidebar badge and Settings stay in sync. */
export function DemoProvider({ children }: { children: ReactNode }) {
  const api = useApi()
  const [enabled, setEnabledState] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    void api.demo.isEnabled().then((value) => active && setEnabledState(value))
    return () => {
      active = false
    }
  }, [api])

  async function setEnabled(next: boolean) {
    await api.demo.setEnabled(next)
    setEnabledState(next)
  }

  return <DemoContext value={{ enabled, setEnabled }}>{children}</DemoContext>
}
