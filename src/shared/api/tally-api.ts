import type { BackupSummary } from './backup'
import type { TimeOfDay } from '../domain/time'
import type { HabitRepository } from './habit-repository'

/**
 * The contract between the React UI and the platform it runs on.
 *
 * The Electron preload script implements it and exposes it as `window.tally`.
 * A future web or mobile build only needs another implementation of this interface.
 */
export interface TallyApi extends HabitRepository {
  app: {
    getInfo(): Promise<AppInfo>
  }
  preferences: {
    get(): Promise<Preferences>
    update(change: Partial<Preferences>): Promise<Preferences>
  }
  demo: {
    isEnabled(): Promise<boolean>
    /** Turning it on swaps in fresh example data; the real data is never read or written meanwhile. */
    setEnabled(enabled: boolean): Promise<void>
  }
  backup: {
    /** Asks where to save, then writes a JSON backup of all data. */
    export(): Promise<ExportResult>
    /** Asks for a file and validates it. Nothing changes until `confirmImport`. Null if cancelled. */
    pickImport(): Promise<ImportPreview | null>
    /** Replaces all data with the picked backup, after saving a safety copy of the current data. */
    confirmImport(token: string): Promise<ImportResult>
    cancelImport(): Promise<void>
  }
}

/** User preferences that are not habit data (kept outside the database). */
export interface Preferences {
  /** Show the Tally icon with today's progress in the macOS menu bar. */
  showInMenuBar: boolean
  /** Send a notification at `reminderTime` when habits are still open that day. */
  reminderEnabled: boolean
  reminderTime: TimeOfDay
}

export type ExportResult = { saved: false } | { saved: true; path: string }

export interface ImportPreview {
  token: string
  fileName: string
  summary: BackupSummary
  /** What will be replaced. */
  current: { habits: number; logs: number }
}

export interface ImportResult {
  safetyBackupPath: string
}

export interface AppInfo {
  name: string
  version: string
  platform: 'mac' | 'web' | 'other'
}

/** IPC channel names, shared by main and preload so they never drift apart. */
export const IpcChannel = {
  appGetInfo: 'app:get-info',
  habitsList: 'habits:list',
  habitsCreate: 'habits:create',
  habitsUpdate: 'habits:update',
  habitsArchive: 'habits:archive',
  habitsUnarchive: 'habits:unarchive',
  habitsReorder: 'habits:reorder',
  logsListRange: 'logs:list-range',
  logsListForHabit: 'logs:list-for-habit',
  logsSet: 'logs:set',
  logsClear: 'logs:clear',
  preferencesGet: 'preferences:get',
  preferencesUpdate: 'preferences:update',
  demoIsEnabled: 'demo:is-enabled',
  demoSetEnabled: 'demo:set-enabled',
  backupExport: 'backup:export',
  backupPickImport: 'backup:pick-import',
  backupConfirmImport: 'backup:confirm-import',
  backupCancelImport: 'backup:cancel-import',
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

/** Channels that change habit data. The app refreshes anything that shows today's progress after them. */
export const DATA_CHANGING_CHANNELS: ReadonlySet<IpcChannelName> = new Set<IpcChannelName>([
  IpcChannel.habitsCreate,
  IpcChannel.habitsUpdate,
  IpcChannel.habitsArchive,
  IpcChannel.habitsUnarchive,
  IpcChannel.habitsReorder,
  IpcChannel.logsSet,
  IpcChannel.logsClear,
  IpcChannel.demoSetEnabled,
  IpcChannel.backupConfirmImport,
])
