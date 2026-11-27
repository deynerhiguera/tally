import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { AppInfo } from '@shared/api/tally-api'
import { BackupService, type FileDialogs } from './backup-service'
import { DataSources } from './data-sources'
import { SettingsStore } from './settings-store'
import { createIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null
let sources: DataSources | null = null

// `npm run dev` gets its own data folder, so development never touches the data of the
// installed app (~/Library/Application Support/Tally). Must run before the single-instance lock.
if (!app.isPackaged) app.setPath('userData', join(app.getPath('appData'), 'Tally Dev'))

// Single instance: a second launch focuses the window that is already open.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    const userData = app.getPath('userData')
    const settings = new SettingsStore(userData)
    const opened = new DataSources(userData, settings)
    sources = opened
    registerIpcHandlers(opened, new BackupService(() => opened.real, fileDialogs, join(userData, 'backups')))
    mainWindow = createWindow()

    // macOS: clicking the Dock icon with no windows open recreates one.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
  })

  app.on('will-quit', () => {
    sources?.close()
    sources = null
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Tally',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  // Links open in the default browser, never inside the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return window
}

const BACKUP_FILTERS = [{ name: 'Tally backup', extensions: ['json'] }]

const fileDialogs: FileDialogs = {
  async chooseSavePath(defaultName) {
    const options = { defaultPath: join(app.getPath('documents'), defaultName), filters: BACKUP_FILTERS }
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options)
    return result.canceled || !result.filePath ? null : result.filePath
  },
  async chooseOpenPath() {
    const options = { filters: BACKUP_FILTERS, properties: ['openFile' as const] }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  },
}

function registerIpcHandlers(dataSources: DataSources, backup: BackupService): void {
  const appInfo = (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform === 'darwin' ? 'mac' : 'other',
  })
  for (const [channel, handler] of Object.entries(createIpcHandlers(dataSources, appInfo, backup))) {
    ipcMain.handle(channel, (_event, ...args: unknown[]) => handler(...args))
  }
}
