import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { createBackup, parseBackup, summarizeBackup, type Backup } from '@shared/api/backup'
import { InvalidInputError } from '@shared/api/parse'
import type { ExportResult, ImportPreview, ImportResult } from '@shared/api/tally-api'
import { toIsoDate } from '@shared/domain/date'
import type { HabitStore } from './db/habit-store'

/** Native file pickers. Electron's `dialog` in the app, fakes in tests. Null means cancelled. */
export interface FileDialogs {
  chooseSavePath(defaultName: string): Promise<string | null>
  chooseOpenPath(): Promise<string | null>
}

const MAX_BACKUP_BYTES = 20 * 1024 * 1024

/**
 * Export and import of JSON backups. Import is two steps so the user can review what the
 * file contains first: `pickImport` validates the whole file and keeps it in memory, and
 * `confirmImport` replaces the data after saving a safety copy of the current data.
 */
export class BackupService {
  private pending: { token: string; backup: Backup } | null = null

  constructor(
    /** The store to back up (the real one: demo data is never backed up). */
    private readonly store: () => HabitStore,
    private readonly dialogs: FileDialogs,
    /** Where safety copies are written before an import replaces data. */
    private readonly safetyDir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async exportToFile(): Promise<ExportResult> {
    const path = await this.dialogs.chooseSavePath(`tally-backup-${toIsoDate(this.now())}.json`)
    if (!path) return { saved: false }
    this.writeBackup(path)
    return { saved: true, path }
  }

  async pickImport(): Promise<ImportPreview | null> {
    const path = await this.dialogs.chooseOpenPath()
    if (!path) return null
    if (statSync(path).size > MAX_BACKUP_BYTES) {
      throw new InvalidInputError('This file is too large to be a Tally backup.')
    }

    let json: unknown
    try {
      json = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      throw new InvalidInputError('This file is not valid JSON.')
    }
    const backup = parseBackup(json)
    const token = randomUUID()
    this.pending = { token, backup }

    const current = this.store().exportAll()
    return {
      token,
      fileName: basename(path),
      summary: summarizeBackup(backup),
      current: { habits: current.habits.length, logs: current.logs.length },
    }
  }

  confirmImport(token: string): ImportResult {
    if (!this.pending || this.pending.token !== token) {
      throw new InvalidInputError('This import has expired. Choose the file again.')
    }
    const { backup } = this.pending
    mkdirSync(this.safetyDir, { recursive: true })
    const stamp = this.now().toISOString().replace(/[:.]/g, '-')
    const safetyBackupPath = join(this.safetyDir, `before-import-${stamp}.json`)
    this.writeBackup(safetyBackupPath)

    this.store().replaceAll(backup.habits, backup.logs)
    this.pending = null
    return { safetyBackupPath }
  }

  cancelImport(): void {
    this.pending = null
  }

  private writeBackup(path: string): void {
    const { habits, logs } = this.store().exportAll()
    writeFileSync(path, `${JSON.stringify(createBackup(habits, logs, this.now()), null, 2)}\n`, 'utf8')
  }
}
