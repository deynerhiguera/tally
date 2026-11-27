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
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]
