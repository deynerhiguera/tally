// @vitest-environment node
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DataSources } from './data-sources'

let dir: string
let sources: DataSources
const now = () => new Date(2026, 10, 27, 10, 0)

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tally-sources-'))
  sources = new DataSources(dir, now)
})
afterEach(() => {
  sources.close()
  rmSync(dir, { recursive: true, force: true })
})

function seedReal() {
  const habit = sources.real.createHabit({
    name: 'My real habit',
    kind: 'BUILD',
    target: { type: 'DAILY_CHECK' },
    startDate: '2026-11-01',
  })
  sources.real.setLog({ habitId: habit.id, date: '2026-11-20', value: { type: 'CHECK', done: true } })
}

describe('DataSources', () => {
  it('starts on the real data', () => {
    seedReal()
    expect(sources.isDemo()).toBe(false)
    expect(sources.active()).toBe(sources.real)
  })

  it('swaps in demo data that ends today', () => {
    seedReal()
    sources.setDemo(true)
    const habits = sources.active().listHabits()
    expect(habits.map((h) => h.name)).toContain('Anki review')
    expect(habits.map((h) => h.name)).not.toContain('My real habit')
    expect(sources.active().listLogsInRange('2026-11-27', '2026-11-27').length).toBeGreaterThan(0)
  })

  it('never changes the real data, even when demo data is edited', () => {
    seedReal()
    const before = sources.real.exportAll()

    sources.setDemo(true)
    const demo = sources.active()
    const [first] = demo.listHabits()
    demo.archiveHabit(first?.id ?? '', '2026-11-27')
    demo.createHabit({
      name: 'Demo only',
      kind: 'BUILD',
      target: { type: 'DAILY_CHECK' },
      startDate: '2026-11-27',
    })
    sources.setDemo(false)

    expect(sources.active()).toBe(sources.real)
    expect(sources.real.exportAll()).toEqual(before)
  })

  it('starts demo mode fresh each time and removes the demo file when turned off', () => {
    sources.setDemo(true)
    const demo = sources.active()
    demo.createHabit({
      name: 'Leftover',
      kind: 'BUILD',
      target: { type: 'DAILY_CHECK' },
      startDate: '2026-11-27',
    })
    sources.setDemo(false)
    expect(existsSync(join(dir, 'demo.db'))).toBe(false)

    sources.setDemo(true)
    const names = sources
      .active()
      .listHabits()
      .map((h) => h.name)
    expect(names).not.toContain('Leftover')
  })

  it('remembers demo mode across restarts', () => {
    sources.setDemo(true)
    sources.close()
    sources = new DataSources(dir, now)
    expect(sources.isDemo()).toBe(true)

    sources.setDemo(false)
    sources.close()
    sources = new DataSources(dir, now)
    expect(sources.isDemo()).toBe(false)
  })

  it('ignores a broken settings file', () => {
    sources.close()
    writeFileSync(join(dir, 'settings.json'), '{ broken')
    sources = new DataSources(dir, now)
    expect(sources.isDemo()).toBe(false)
  })

  it('blocks actions that must not run on demo data', () => {
    expect(() => sources.assertNotDemo('export a backup')).not.toThrow()
    sources.setDemo(true)
    expect(() => sources.assertNotDemo('export a backup')).toThrow('Turn off demo mode to export a backup.')
  })
})
