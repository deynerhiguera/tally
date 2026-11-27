import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isTimeOfDay, type TimeOfDay } from '@shared/domain/time'

/** App preferences, stored as JSON in the user data folder (not in the database, so they survive imports). */
export interface Settings {
  demoMode: boolean
  showInMenuBar: boolean
  reminderEnabled: boolean
  reminderTime: TimeOfDay
}

export const DEFAULT_SETTINGS: Settings = {
  demoMode: false,
  showInMenuBar: true,
  reminderEnabled: false,
  reminderTime: '21:00',
}

/**
 * Reads and writes `settings.json`. Unknown keys are dropped and wrong types fall back to
 * defaults, so a hand-edited or older file never breaks startup.
 */
export class SettingsStore {
  private readonly path: string
  private current: Settings

  constructor(dir: string) {
    this.path = join(dir, 'settings.json')
    this.current = this.read()
  }

  get(): Settings {
    return { ...this.current }
  }

  update(change: Partial<Settings>): Settings {
    this.current = { ...this.current, ...change }
    writeFileSync(this.path, `${JSON.stringify(this.current, null, 2)}\n`, 'utf8')
    return this.get()
  }

  private read(): Settings {
    if (!existsSync(this.path)) return { ...DEFAULT_SETTINGS }
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(this.path, 'utf8'))
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
    const value = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const bool = (key: 'demoMode' | 'showInMenuBar' | 'reminderEnabled') =>
      typeof value[key] === 'boolean' ? (value[key] as boolean) : DEFAULT_SETTINGS[key]
    const time = value['reminderTime']
    return {
      demoMode: bool('demoMode'),
      showInMenuBar: bool('showInMenuBar'),
      reminderEnabled: bool('reminderEnabled'),
      reminderTime: typeof time === 'string' && isTimeOfDay(time) ? time : DEFAULT_SETTINGS.reminderTime,
    }
  }
}
