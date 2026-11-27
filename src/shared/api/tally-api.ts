/**
 * The contract between the React UI and the platform it runs on.
 *
 * The Electron preload script implements it and exposes it as `window.tally`.
 * A future web or mobile build only needs another implementation of this interface.
 */
export interface TallyApi {
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
} as const
