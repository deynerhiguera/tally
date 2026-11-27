// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SettingsStore } from './settings-store'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tally-settings-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('SettingsStore', () => {
  it('starts with defaults when there is no file', () => {
    expect(new SettingsStore(dir).get()).toEqual(DEFAULT_SETTINGS)
  })

  it('saves changes and reads them back after a restart', () => {
    new SettingsStore(dir).update({ showInMenuBar: false })
    expect(new SettingsStore(dir).get()).toEqual({ demoMode: false, showInMenuBar: false })
    expect(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))).toEqual({
      demoMode: false,
      showInMenuBar: false,
    })
  })

  it('keeps settings written by an older version and fills in new ones', () => {
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ demoMode: true }))
    expect(new SettingsStore(dir).get()).toEqual({ demoMode: true, showInMenuBar: true })
  })

  it('falls back to defaults for broken files and wrong types', () => {
    writeFileSync(join(dir, 'settings.json'), '{ broken')
    expect(new SettingsStore(dir).get()).toEqual(DEFAULT_SETTINGS)
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ demoMode: 'yes', extra: 1 }))
    expect(new SettingsStore(dir).get()).toEqual(DEFAULT_SETTINGS)
  })

  it('returns copies', () => {
    const store = new SettingsStore(dir)
    store.get().demoMode = true
    expect(store.get().demoMode).toBe(false)
  })
})
