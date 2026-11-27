import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from '../api/backup'
import { LOG_VALUE_TYPE } from '../domain/habit'
import { createDemoData, DEMO_DAYS } from './demo-data'

const TODAY = '2026-11-27'

describe('createDemoData', () => {
  const data = createDemoData(TODAY)

  it('is valid data that passes the backup validation', () => {
    const json = JSON.parse(JSON.stringify(createBackup(data.habits, data.logs)))
    expect(() => parseBackup(json)).not.toThrow()
  })

  it('covers every target type and includes an archived habit', () => {
    const types = new Set(data.habits.map((habit) => habit.target.type))
    expect([...types].sort()).toEqual(Object.keys(LOG_VALUE_TYPE).sort())
    expect(data.habits.some((habit) => habit.archivedDate !== undefined)).toBe(true)
  })

  it('covers the last 90 days and never the future', () => {
    const dates = data.logs.map((log) => log.date).sort()
    expect(dates.at(-1)).toBe(TODAY)
    expect(dates[0]).toBe('2026-08-30')
    expect(new Set(dates).size).toBeGreaterThan(DEMO_DAYS - 5)
  })

  it('leaves part of today open, like a real morning', () => {
    const today = data.logs.filter((log) => log.date === TODAY).map((log) => log.habitId)
    expect(today).not.toContain('demo-bed')
    expect(today).not.toContain('demo-stress')
  })

  it('is deterministic for the same day and changes with the day', () => {
    expect(createDemoData(TODAY)).toEqual(data)
    expect(createDemoData('2026-11-28').logs).not.toEqual(data.logs)
  })
})
