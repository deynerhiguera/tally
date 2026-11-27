import type { DayStatus } from '@shared/domain/evaluate'
import type { HabitTarget } from '@shared/domain/habit'
import { statusLabel } from '../lib/status'

export function StatusPill({ target, status }: { target: HabitTarget; status: DayStatus }) {
  return <span className={`status status-${status}`}>{statusLabel(target, status)}</span>
}
