import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import type { AppInfo } from '@shared/api/tally-api'
import { openDatabase } from './db/database'
import { HabitStore } from './db/habit-store'
import { createIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null
let db: DatabaseSync | null = null

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
    db = openDatabase(join(app.getPath('userData'), 'tally.db'))
    registerIpcHandlers(new HabitStore(db))
    mainWindow = createWindow()

    // macOS: clicking the Dock icon with no windows open recreates one.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
  })

  app.on('will-quit', () => {
    db?.close()
    db = null
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

function registerIpcHandlers(store: HabitStore): void {
  const appInfo = (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform === 'darwin' ? 'mac' : 'other',
  })
  for (const [channel, handler] of Object.entries(createIpcHandlers(store, appInfo))) {
    ipcMain.handle(channel, (_event, ...args: unknown[]) => handler(...args))
  }
}
