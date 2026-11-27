import { toIsoDate, type IsoDate } from '@shared/domain/date'
import { timeToMinutes, type TimeOfDay } from '@shared/domain/time'

/** How long after the reminder time a missed reminder (Mac asleep, app closed) is still sent. */
export const CATCH_UP_MINUTES = 60

export interface ReminderState {
  enabled: boolean
  time: TimeOfDay
  /** Calendar date of the last reminder sent, so it is never sent twice a day. */
  lastSentOn: IsoDate | null
}

/**
 * Whether the daily reminder is due at `now`: it is enabled, it was not sent today, and
 * `now` is between the reminder time and one hour after it. Checked every minute, so a
 * reminder missed while the Mac slept still arrives shortly after waking, but opening the
 * app late in the evening does not trigger an old reminder.
 */
export function isReminderDue(now: Date, state: ReminderState): boolean {
  if (!state.enabled || state.lastSentOn === toIsoDate(now)) return false
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const due = timeToMinutes(state.time)
  return minutesNow >= due && minutesNow < due + CATCH_UP_MINUTES
}

/** Notification text for the number of habits still open today; null when there is nothing to remind. */
export function reminderMessage(open: number): string | null {
  if (open <= 0) return null
  return open === 1 ? '1 habit left to log today.' : `${open} habits left to log today.`
}
