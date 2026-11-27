import { IpcChannel, type AppInfo, type IpcChannelName } from '@shared/api/tally-api'
import { parseDate, parseHabitInput, parseHabitLog, parseId, parseIdList } from '@shared/api/parse'
import type { BackupService } from './backup-service'
import type { HabitStore } from './db/habit-store'

export type IpcHandler = (...args: unknown[]) => unknown

/**
 * Every IPC handler, keyed by channel. Arguments from the renderer are untrusted,
 * so each one is parsed before it reaches the store. Kept free of Electron imports
 * so it can be tested directly.
 */
export function createIpcHandlers(
  store: HabitStore,
  appInfo: () => AppInfo,
  backup: BackupService,
): Record<IpcChannelName, IpcHandler> {
  return {
    [IpcChannel.appGetInfo]: () => appInfo(),
    [IpcChannel.habitsList]: () => store.listHabits(),
    [IpcChannel.habitsCreate]: (input) => store.createHabit(parseHabitInput(input)),
    [IpcChannel.habitsUpdate]: (id, input) => store.updateHabit(parseId(id), parseHabitInput(input)),
    [IpcChannel.habitsArchive]: (id, date) => store.archiveHabit(parseId(id), parseDate(date)),
    [IpcChannel.habitsUnarchive]: (id) => store.unarchiveHabit(parseId(id)),
    [IpcChannel.habitsReorder]: (ids) => store.reorderHabits(parseIdList(ids)),
    [IpcChannel.logsListRange]: (from, to) =>
      store.listLogsInRange(parseDate(from, 'from'), parseDate(to, 'to')),
    [IpcChannel.logsListForHabit]: (habitId) => store.listLogsForHabit(parseId(habitId, 'habitId')),
    [IpcChannel.logsSet]: (log) => store.setLog(parseHabitLog(log)),
    [IpcChannel.backupExport]: () => backup.exportToFile(),
    [IpcChannel.backupPickImport]: () => backup.pickImport(),
    [IpcChannel.backupConfirmImport]: (token) => backup.confirmImport(parseId(token, 'token')),
    [IpcChannel.backupCancelImport]: () => backup.cancelImport(),
    [IpcChannel.logsClear]: (habitId, date) => store.clearLog(parseId(habitId, 'habitId'), parseDate(date)),
  }
}
