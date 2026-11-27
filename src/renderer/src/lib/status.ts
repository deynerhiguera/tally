import type { DayStatus } from '@shared/domain/evaluate'
import type { HabitTarget } from '@shared/domain/habit'

const isLimit = (target: HabitTarget) => target.type === 'DAILY_LIMIT' || target.type === 'WEEKLY_LIMIT'

/** Short, habit-aware wording for a day's status. */
export function statusLabel(target: HabitTarget, status: DayStatus): string {
  switch (status) {
    case 'success':
      return isLimit(target) ? 'Within limit' : 'Done'
    case 'fail':
      if (isLimit(target)) return 'Over limit'
      return target.type === 'TARGET_TIME' ? 'Late' : 'Missed'
    case 'pending':
      return isLimit(target) ? 'On track' : 'To do'
    case 'tracked':
      return 'Logged'
    case 'untracked':
      return 'Not logged'
    case 'inactive':
      return 'Not active'
    case 'future':
      return 'Upcoming'
  }
}
