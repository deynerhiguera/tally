import { addDays, eachDay, isWeekend, type IsoDate } from '../domain/date'
import type { Habit, HabitLog, LogValue, ScaleLevel } from '../domain/habit'
import type { TimeOfDay } from '../domain/time'

/** How many days of history the demo data covers, ending today. */
export const DEMO_DAYS = 90

/** Small deterministic PRNG (mulberry32), so the same day always gives the same demo data. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function toTime(totalMinutes: number): TimeOfDay {
  const minutes = ((Math.round(totalMinutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}` as TimeOfDay
}

const clampLevel = (value: number) => Math.min(5, Math.max(1, Math.round(value))) as ScaleLevel

/**
 * Fake but believable example data for screenshots and videos: eight habits covering every
 * target type, about 90 days of logs that improve over time, weekends a little worse,
 * and today partly logged. Pure and deterministic for a given `today`.
 */
export function createDemoData(today: IsoDate): { habits: Habit[]; logs: HabitLog[] } {
  const start = addDays(today, -(DEMO_DAYS - 1))
  const random = createRandom(Number(today.replaceAll('-', '')))
  const chance = (p: number) => random() < p

  const habit = (id: string, name: string, kind: Habit['kind'], target: Habit['target']): Habit => ({
    id: `demo-${id}`,
    name,
    kind,
    target,
    startDate: start,
  })

  const habits: Habit[] = [
    habit('anki', 'Anki review', 'BUILD', { type: 'DAILY_CHECK' }),
    habit('mobility', 'Mobility 10 min', 'BUILD', { type: 'DAILY_CHECK' }),
    habit('wake', 'Wake up', 'BUILD', { type: 'TARGET_TIME', goal: '05:30' }),
    habit('bed', 'In bed', 'BUILD', { type: 'TARGET_TIME', goal: '22:00' }),
    habit('series', 'TV episodes', 'BREAK', { type: 'DAILY_LIMIT', max: 1 }),
    habit('sweets', 'Sweets', 'BREAK', { type: 'WEEKLY_LIMIT', max: 2 }),
    habit('stress', 'Stress level', 'BUILD', { type: 'DAILY_SCALE', rule: { op: 'lte', value: 2 } }),
    habit('mood', 'Mood', 'BUILD', { type: 'DAILY_SCALE' }),
  ]
  // A finished challenge, to show archiving.
  habits.push({
    ...habit('cold', 'Cold shower challenge', 'BUILD', { type: 'DAILY_CHECK' }),
    startDate: addDays(start, 10),
    archivedDate: addDays(start, 40),
  })

  const notes = ['Busy day at work', 'Slept badly', 'Good run', 'Calm morning', 'Deadline', 'Family visit']
  const logs: HabitLog[] = []
  const log = (id: string, date: IsoDate, value: LogValue) =>
    logs.push({ habitId: `demo-${id}`, date, value })

  for (const [index, date] of eachDay(start, today).entries()) {
    const progress = index / (DEMO_DAYS - 1) // 0 → 1: habits get easier over time
    const weekend = isWeekend(date)
    const isToday = date === today
    // Today: only the morning habits are logged yet.
    const morningOnly = isToday

    if (chance(0.65 + 0.3 * progress - (weekend ? 0.15 : 0))) log('anki', date, { type: 'CHECK', done: true })
    if (!morningOnly && chance(0.45 + 0.35 * progress)) log('mobility', date, { type: 'CHECK', done: true })

    const wake = 322 - 14 * progress + (weekend ? 20 : 0) + (random() - 0.5) * 30
    if (chance(0.95)) log('wake', date, { type: 'TIME', time: toTime(wake) })

    if (!morningOnly) {
      const bed = 1320 + 8 - 28 * progress + (weekend ? 25 : 0) + (random() - 0.5) * 40
      if (chance(0.92)) log('bed', date, { type: 'TIME', time: toTime(bed) })

      const episodes = chance(0.45 - 0.2 * progress + (weekend ? 0.25 : 0)) ? (chance(0.25) ? 2 : 1) : 0
      if (episodes > 0) log('series', date, { type: 'COUNT', count: episodes })

      if (chance(weekend ? 0.45 : 0.15)) log('sweets', date, { type: 'COUNT', count: 1 })

      const stress = clampLevel(3.2 - 1.4 * progress - (weekend ? 0.6 : 0) + (random() - 0.5) * 2)
      const note = chance(0.2) ? notes[Math.floor(random() * notes.length)] : undefined
      log('stress', date, note ? { type: 'SCALE', level: stress, note } : { type: 'SCALE', level: stress })

      if (chance(0.85))
        log('mood', date, { type: 'SCALE', level: clampLevel(3 + progress + (random() - 0.5) * 2) })
    }

    const cold = habits.find((h) => h.id === 'demo-cold')
    if (cold && date >= cold.startDate && cold.archivedDate && date < cold.archivedDate && chance(0.8)) {
      log('cold', date, { type: 'CHECK', done: true })
    }
  }

  return { habits, logs }
}
