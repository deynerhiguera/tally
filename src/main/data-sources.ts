import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { InvalidInputError } from '@shared/api/parse'
import { logicalDateOf } from '@shared/domain/date'
import { createDemoData } from '@shared/demo/demo-data'
import { openDatabase } from './db/database'
import { HabitStore } from './db/habit-store'
import type { SettingsStore } from './settings-store'

/**
 * Owns the real database and, while demo mode is on, a separate demo database.
 * Demo mode never reads or writes the real data: it swaps which store is active.
 * The demo database is rebuilt from fresh example data every time demo mode is turned on.
 */
export class DataSources {
  private readonly realDb: DatabaseSync
  readonly real: HabitStore
  private demoDb: DatabaseSync | null = null
  private demo: HabitStore | null = null

  constructor(
    private readonly dir: string,
    private readonly settings: SettingsStore,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.realDb = openDatabase(join(dir, 'tally.db'))
    this.real = new HabitStore(this.realDb, now)
    if (settings.get().demoMode) this.openDemo()
  }

  /** The store every habit and log call goes to right now. */
  active(): HabitStore {
    return this.demo ?? this.real
  }

  isDemo(): boolean {
    return this.demo !== null
  }

  setDemo(enabled: boolean): void {
    if (enabled === this.isDemo()) return
    if (enabled) this.openDemo()
    else this.closeDemo()
    this.settings.update({ demoMode: enabled })
  }

  /** Throws when demo mode is on. Used to keep demo data out of backups and imports. */
  assertNotDemo(action: string): void {
    if (this.isDemo()) throw new InvalidInputError(`Turn off demo mode to ${action}.`)
  }

  close(): void {
    this.closeDemo()
    this.realDb.close()
  }

  private get demoPath(): string {
    return join(this.dir, 'demo.db')
  }

  private openDemo(): void {
    this.removeDemoFiles()
    this.demoDb = openDatabase(this.demoPath)
    this.demo = new HabitStore(this.demoDb, this.now)
    const { habits, logs } = createDemoData(logicalDateOf(this.now()))
    this.demo.replaceAll(habits, logs)
  }

  private closeDemo(): void {
    this.demoDb?.close()
    this.demoDb = null
    this.demo = null
    this.removeDemoFiles()
  }

  private removeDemoFiles(): void {
    for (const suffix of ['', '-wal', '-shm']) rmSync(this.demoPath + suffix, { force: true })
  }
}
