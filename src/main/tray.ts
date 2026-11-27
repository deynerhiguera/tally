import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron'
import type { TraySummary } from './tray-summary'

interface TrayDeps {
  /** Path to `trayTemplate.png`; the `@2x` file next to it is picked up automatically. */
  iconPath: string
  summary(): TraySummary
  /** "Friday, November 27" */
  dateLabel(): string
  openWindow(): void
  quit(): void
}

/**
 * The menu bar icon. Shows today's progress next to the icon ("3/7") and, on click,
 * a menu listing today's habits with their status. The menu is rebuilt on every click,
 * so it is always current; `refresh()` only updates the title.
 */
export class TrayController {
  private tray: Tray | null = null

  constructor(private readonly deps: TrayDeps) {}

  setVisible(visible: boolean): void {
    if (visible && !this.tray) this.create()
    if (!visible && this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }

  refresh(): void {
    this.tray?.setTitle(this.deps.summary().title, { fontType: 'monospacedDigit' })
  }

  private create(): void {
    const icon = nativeImage.createFromPath(this.deps.iconPath)
    icon.setTemplateImage(true)
    const tray = new Tray(icon)
    tray.setToolTip('Tally')
    const open = () => tray.popUpContextMenu(this.buildMenu())
    tray.on('click', open)
    tray.on('right-click', open)
    this.tray = tray
    this.refresh()
  }

  private buildMenu(): Menu {
    const { items } = this.deps.summary()
    const habitItems: MenuItemConstructorOptions[] =
      items.length === 0
        ? [{ label: 'No habits for today', enabled: false }]
        : items.map((item) => ({ label: item.label, click: () => this.deps.openWindow() }))

    this.refresh()
    return Menu.buildFromTemplate([
      { label: `Today · ${this.deps.dateLabel()}`, enabled: false },
      { type: 'separator' },
      ...habitItems,
      { type: 'separator' },
      { label: 'Open Tally', accelerator: 'CommandOrControl+O', click: () => this.deps.openWindow() },
      { label: 'Quit Tally', accelerator: 'CommandOrControl+Q', click: () => this.deps.quit() },
    ])
  }
}
