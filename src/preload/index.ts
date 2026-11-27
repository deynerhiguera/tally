import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, RendererEvent, type TallyApi } from '@shared/api/tally-api'

// A thin mapping from the TallyApi contract to IPC calls. No logic lives here.
const api: TallyApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IpcChannel.appGetInfo),
    onNavigate(listener) {
      const handler = (_event: unknown, path: unknown) => {
        if (typeof path === 'string') listener(path)
      }
      ipcRenderer.on(RendererEvent.navigate, handler)
      return () => ipcRenderer.removeListener(RendererEvent.navigate, handler)
    },
  },
  reminder: {
    test: () => ipcRenderer.invoke(IpcChannel.reminderTest),
  },
  habits: {
    list: () => ipcRenderer.invoke(IpcChannel.habitsList),
    create: (input) => ipcRenderer.invoke(IpcChannel.habitsCreate, input),
    update: (id, input) => ipcRenderer.invoke(IpcChannel.habitsUpdate, id, input),
    archive: (id, date) => ipcRenderer.invoke(IpcChannel.habitsArchive, id, date),
    unarchive: (id) => ipcRenderer.invoke(IpcChannel.habitsUnarchive, id),
    reorder: (ids) => ipcRenderer.invoke(IpcChannel.habitsReorder, ids),
  },
  preferences: {
    get: () => ipcRenderer.invoke(IpcChannel.preferencesGet),
    update: (change) => ipcRenderer.invoke(IpcChannel.preferencesUpdate, change),
  },
  demo: {
    isEnabled: () => ipcRenderer.invoke(IpcChannel.demoIsEnabled),
    setEnabled: (enabled) => ipcRenderer.invoke(IpcChannel.demoSetEnabled, enabled),
  },
  backup: {
    export: () => ipcRenderer.invoke(IpcChannel.backupExport),
    pickImport: () => ipcRenderer.invoke(IpcChannel.backupPickImport),
    confirmImport: (token) => ipcRenderer.invoke(IpcChannel.backupConfirmImport, token),
    cancelImport: () => ipcRenderer.invoke(IpcChannel.backupCancelImport),
  },
  logs: {
    listRange: (from, to) => ipcRenderer.invoke(IpcChannel.logsListRange, from, to),
    listForHabit: (habitId) => ipcRenderer.invoke(IpcChannel.logsListForHabit, habitId),
    set: (log) => ipcRenderer.invoke(IpcChannel.logsSet, log),
    clear: (habitId, date) => ipcRenderer.invoke(IpcChannel.logsClear, habitId, date),
  },
}

contextBridge.exposeInMainWorld('tally', api)
