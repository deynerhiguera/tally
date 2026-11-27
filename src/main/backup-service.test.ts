// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { InvalidInputError } from '@shared/api/parse'
import { BackupService, type FileDialogs } from './backup-service'
import { openDatabase } from './db/database'
import { HabitStore } from './db/habit-store'

let dir: string
let store: HabitStore
let dialogs: { save: string | null; open: string | null }
let service: BackupService

const fakeDialogs: FileDialogs = {
  chooseSavePath: async () => dialogs.save,
  chooseOpenPath: async () => dialogs.open,
}
const now = () => new Date('2026-11-27T10:00:00Z')

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tally-backup-'))
  store = new HabitStore(openDatabase(':memory:'), now)
  dialogs = { save: null, open: null }
  service = new BackupService(() => store, fakeDialogs, join(dir, 'safety'), now)
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function seed(target: HabitStore) {
  const habit = target.createHabit({
    name: 'Anki',
    kind: 'BUILD',
    target: { type: 'DAILY_CHECK' },
    startDate: '2026-11-01',
  })
  target.setLog({ habitId: habit.id, date: '2026-11-20', value: { type: 'CHECK', done: true } })
  return habit
}

describe('BackupService', () => {
  it('does nothing when a dialog is cancelled', async () => {
    expect(await service.exportToFile()).toEqual({ saved: false })
    expect(await service.pickImport()).toBeNull()
  })

  it('exports a readable, versioned JSON file', async () => {
    seed(store)
    dialogs.save = join(dir, 'backup.json')
    expect(await service.exportToFile()).toEqual({ saved: true, path: dialogs.save })

    const file = JSON.parse(readFileSync(dialogs.save, 'utf8'))
    expect(file).toMatchObject({ app: 'tally', schemaVersion: 1, exportedAt: '2026-11-27T10:00:00.000Z' })
    expect(file.habits).toHaveLength(1)
    expect(file.logs).toHaveLength(1)
  })

  it('round-trips: export, then import into another database gives identical data', async () => {
    seed(store)
    dialogs.save = join(dir, 'backup.json')
    await service.exportToFile()

    const otherStore = new HabitStore(openDatabase(':memory:'), now)
    otherStore.createHabit({
      name: 'Other',
      kind: 'BUILD',
      target: { type: 'DAILY_CHECK' },
      startDate: '2026-11-01',
    })
    const other = new BackupService(
      () => otherStore,
      { ...fakeDialogs, chooseOpenPath: async () => dialogs.save },
      join(dir, 'safety'),
      now,
    )

    const preview = await other.pickImport()
    expect(preview).toMatchObject({
      fileName: 'backup.json',
      summary: { habits: 1, logs: 1, firstDate: '2026-11-20', lastDate: '2026-11-20' },
      current: { habits: 1, logs: 0 },
    })
    other.confirmImport(preview?.token ?? '')

    expect(otherStore.exportAll()).toEqual(store.exportAll())
  })

  it('saves a safety copy of the current data before replacing it', async () => {
    seed(store)
    const file = join(dir, 'empty.json')
    writeFileSync(
      file,
      JSON.stringify({
        app: 'tally',
        schemaVersion: 1,
        exportedAt: now().toISOString(),
        habits: [],
        logs: [],
      }),
    )
    dialogs.open = file

    const preview = await service.pickImport()
    const { safetyBackupPath } = service.confirmImport(preview?.token ?? '')

    expect(store.exportAll()).toEqual({ habits: [], logs: [] })
    expect(readdirSync(join(dir, 'safety'))).toEqual(['before-import-2026-11-27T10-00-00-000Z.json'])
    expect(JSON.parse(readFileSync(safetyBackupPath, 'utf8')).habits[0].name).toBe('Anki')
  })

  it('rejects invalid files without changing anything', async () => {
    seed(store)
    const before = store.exportAll()
    dialogs.open = join(dir, 'broken.json')

    writeFileSync(dialogs.open, '{ not json')
    await expect(service.pickImport()).rejects.toThrow('not valid JSON')

    writeFileSync(
      dialogs.open,
      JSON.stringify({
        app: 'tally',
        schemaVersion: 2,
        exportedAt: now().toISOString(),
        habits: [],
        logs: [],
      }),
    )
    await expect(service.pickImport()).rejects.toThrow('newer version of Tally')

    expect(store.exportAll()).toEqual(before)
  })

  it('only confirms the import that was previewed', async () => {
    dialogs.open = join(dir, 'b.json')
    writeFileSync(
      dialogs.open,
      JSON.stringify({
        app: 'tally',
        schemaVersion: 1,
        exportedAt: now().toISOString(),
        habits: [],
        logs: [],
      }),
    )
    const preview = await service.pickImport()

    expect(() => service.confirmImport('other-token')).toThrow(InvalidInputError)
    service.cancelImport()
    expect(() => service.confirmImport(preview?.token ?? '')).toThrow('expired')
  })
})
