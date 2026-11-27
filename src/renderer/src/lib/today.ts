import { logicalDateOf, type IsoDate } from '@shared/domain/date'

/** Today's habit date (before 04:00 still counts as yesterday). */
export function today(): IsoDate {
  return logicalDateOf(new Date())
}
