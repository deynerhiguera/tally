import { IpcChannel, type AppInfo, type IpcChannelName, type Preferences } from '@shared/api/tally-api'
import { parseDate, parseHabitInput, parseHabitLog, parseId, parseIdList } from '@shared/api/parse'
import { parseBoolean, parsePreferencesChange } from '@shared/api/parse'
import type { BackupService } from './backup-service'
import type { DataSources } from './data-sources'

export type IpcHandler = (...args: unknown[]) => unknown

export interface PreferencesService {
  get(): Preferences
  update(change: Partial<Preferences>): Preferences
}

/**
 * Every IPC handler, keyed by channel. Arguments from the renderer are untrusted,
 * so each one is parsed before it reaches the store. Kept free of Electron imports
 * so it can be tested directly.
 */
export function createIpcHandlers(
  sources: DataSources,
  appInfo: () => AppInfo,
  backup: BackupService,
  preferences: PreferencesService,
): Record<IpcChannelName, IpcHandler> {
  // Resolved on every call, so demo mode switches take effect immediately.
  const store = () => sources.active()
  return {
    [IpcChannel.appGetInfo]: () => appInfo(),
    [IpcChannel.habitsList]: () => store().listHabits(),
    [IpcChannel.habitsCreate]: (input) => store().createHabit(parseHabitInput(input)),
    [IpcChannel.habitsUpdate]: (id, input) => store().updateHabit(parseId(id), parseHabitInput(input)),
    [IpcChannel.habitsArchive]: (id, date) => store().archiveHabit(parseId(id), parseDate(date)),
    [IpcChannel.habitsUnarchive]: (id) => store().unarchiveHabit(parseId(id)),
    [IpcChannel.habitsReorder]: (ids) => store().reorderHabits(parseIdList(ids)),
    [IpcChannel.logsListRange]: (from, to) =>
      store().listLogsInRange(parseDate(from, 'from'), parseDate(to, 'to')),
    [IpcChannel.logsListForHabit]: (habitId) => store().listLogsForHabit(parseId(habitId, 'habitId')),
    [IpcChannel.logsSet]: (log) => store().setLog(parseHabitLog(log)),
    [IpcChannel.preferencesGet]: () => preferences.get(),
    [IpcChannel.preferencesUpdate]: (change) => preferences.update(parsePreferencesChange(change)),
    [IpcChannel.demoIsEnabled]: () => sources.isDemo(),
    [IpcChannel.demoSetEnabled]: (enabled) => sources.setDemo(parseBoolean(enabled, 'enabled')),
    [IpcChannel.backupExport]: () => {
      sources.assertNotDemo('export a backup')
      return backup.exportToFile()
    },
    [IpcChannel.backupPickImport]: () => {
      sources.assertNotDemo('import a backup')
      return backup.pickImport()
    },
    [IpcChannel.backupConfirmImport]: (token) => {
      sources.assertNotDemo('import a backup')
      return backup.confirmImport(parseId(token, 'token'))
    },
    [IpcChannel.backupCancelImport]: () => backup.cancelImport(),
    [IpcChannel.logsClear]: (habitId, date) => store().clearLog(parseId(habitId, 'habitId'), parseDate(date)),
  }
}
