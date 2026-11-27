import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type TallyApi } from '@shared/api/tally-api'

const api: TallyApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IpcChannel.appGetInfo),
  },
}

contextBridge.exposeInMainWorld('tally', api)
