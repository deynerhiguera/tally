import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { DATA_CHANGING_CHANNELS, type AppInfo, type IpcChannelName } from '@shared/api/tally-api'
import { logicalDateOf, parseIsoDate, weekStartOf } from '@shared/domain/date'
import { BackupService, type FileDialogs } from './backup-service'
import { DataSources } from './data-sources'
import { SettingsStore } from './settings-store'
import { createIpcHandlers, type PreferencesService } from './ipc-handlers'
import { TrayController } from './tray'
import { buildTraySummary } from './tray-summary'

let mainWindow: BrowserWindow | null = null
let tray: TrayController | null = null
let dayTimer: NodeJS.Timeout | null = null
let sources: DataSources | null = null

// `npm run dev` gets its own data folder, so development never touches the data of the
// installed app (~/Library/Application Support/Tally). Must run before the single-instance lock.
if (!app.isPackaged) app.setPath('userData', join(app.getPath('appData'), 'Tally Dev'))

// Single instance: a second launch focuses the window that is already open.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // A second launch (Spotlight, Dock, Launchpad) brings the existing window back, reopening it if closed.
  app.on('second-instance', () => openWindow())

  app.whenReady().then(() => {
    const userData = app.getPath('userData')
    const settings = new SettingsStore(userData)
    const opened = new DataSources(userData, settings)
    sources = opened

    const menuBar = createTray(opened)
    tray = menuBar
    menuBar.setVisible(settings.get().showInMenuBar)
    // The habit day changes at 04:00; check every minute so the menu bar never shows yesterday.
    let lastDay = logicalDateOf(new Date())
    dayTimer = setInterval(() => {
      const day = logicalDateOf(new Date())
      if (day !== lastDay) {
        lastDay = day
        menuBar.refresh()
      }
    }, 60_000)

    const preferences: PreferencesService = {
      get: () => ({ showInMenuBar: settings.get().showInMenuBar }),
      update(change) {
        const next = settings.update(change)
        menuBar.setVisible(next.showInMenuBar)
        return { showInMenuBar: next.showInMenuBar }
      },
    }
    registerIpcHandlers(
      opened,
      new BackupService(() => opened.real, fileDialogs, join(userData, 'backups')),
      preferences,
      () => menuBar.refresh(),
    )
    mainWindow = createWindow()

    // macOS: clicking the Dock icon with no windows open recreates one.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
  })

  app.on('will-quit', () => {
    if (dayTimer) clearInterval(dayTimer)
    tray?.setVisible(false)
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

/** Shows the main window, creating it again if it was closed (macOS keeps the app running). */
function openWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  app.focus({ steal: true })
}

function createTray(dataSources: DataSources): TrayController {
  const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return new TrayController({
    iconPath: join(app.getAppPath(), 'resources', 'trayTemplate.png'),
    summary() {
      const store = dataSources.active()
      const today = logicalDateOf(new Date())
      return buildTraySummary(store.listHabits(), store.listLogsInRange(weekStartOf(today), today), today)
    },
    dateLabel: () => dayFormat.format(parseIsoDate(logicalDateOf(new Date()))),
    openWindow,
    quit: () => app.quit(),
  })
}

function registerIpcHandlers(
  dataSources: DataSources,
  backup: BackupService,
  preferences: PreferencesService,
  onDataChanged: () => void,
): void {
  const appInfo = (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform === 'darwin' ? 'mac' : 'other',
  })
  const handlers = createIpcHandlers(dataSources, appInfo, backup, preferences)
  for (const [channel, handler] of Object.entries(handlers)) {
    const changesData = DATA_CHANGING_CHANNELS.has(channel as IpcChannelName)
    ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
      const result = await handler(...args)
      if (changesData) onDataChanged()
      return result
    })
  }
}
