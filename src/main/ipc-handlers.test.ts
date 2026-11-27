// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { IpcChannel, type IpcChannelName } from '@shared/api/tally-api'
import { InvalidInputError } from '@shared/api/parse'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { BackupService } from './backup-service'
import { DataSources } from './data-sources'
import { createIpcHandlers, type IpcHandler } from './ipc-handlers'

let handlers: Record<IpcChannelName, IpcHandler>
const call = (channel: IpcChannelName, ...args: unknown[]) => handlers[channel](...args)

let dir: string
let sources: DataSources

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tally-ipc-'))
  sources = new DataSources(dir)
  const noDialogs = { chooseSavePath: async () => null, chooseOpenPath: async () => null }
  handlers = createIpcHandlers(
    sources,
    () => ({ name: 'Tally', version: '0.0.0', platform: 'mac' }),
    new BackupService(() => sources.real, noDialogs, join(dir, 'backups')),
  )
})
afterEach(() => {
  sources.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('IPC handlers', () => {
  it('has a handler for every channel', () => {
    expect(Object.keys(handlers).sort()).toEqual(Object.values(IpcChannel).sort())
  })

  it('runs a full habit and log round-trip', () => {
    const habit = call(IpcChannel.habitsCreate, {
      name: 'Rick and Morty',
      kind: 'BREAK',
      target: { type: 'DAILY_LIMIT', max: 1 },
      startDate: '2026-11-01',
    }) as { id: string }

    call(IpcChannel.logsSet, { habitId: habit.id, date: '2026-11-27', value: { type: 'COUNT', count: 1 } })
    expect(call(IpcChannel.logsListRange, '2026-11-01', '2026-11-30')).toHaveLength(1)

    call(IpcChannel.logsClear, habit.id, '2026-11-27')
    expect(call(IpcChannel.logsListForHabit, habit.id)).toEqual([])

    call(IpcChannel.habitsArchive, habit.id, '2026-11-27')
    call(IpcChannel.habitsUnarchive, habit.id)
    call(IpcChannel.habitsReorder, [habit.id])
    call(IpcChannel.habitsUpdate, habit.id, {
      name: 'Series',
      kind: 'BREAK',
      target: { type: 'DAILY_LIMIT', max: 2 },
      startDate: '2026-11-01',
    })
    expect(call(IpcChannel.habitsList)).toMatchObject([{ name: 'Series', target: { max: 2 } }])
  })

  it('rejects malformed input before it reaches the database', () => {
    expect(() => call(IpcChannel.habitsCreate, { name: '' })).toThrow(InvalidInputError)
    expect(() => call(IpcChannel.logsListRange, 'yesterday', '2026-11-30')).toThrow(InvalidInputError)
    expect(() => call(IpcChannel.habitsArchive, 42, '2026-11-27')).toThrow(InvalidInputError)
  })

  it('wires the backup channels', async () => {
    expect(await call(IpcChannel.backupExport)).toEqual({ saved: false })
    expect(await call(IpcChannel.backupPickImport)).toBeNull()
    expect(() => call(IpcChannel.backupConfirmImport, 'stale-token')).toThrow('expired')
    expect(() => call(IpcChannel.backupConfirmImport, 42)).toThrow(InvalidInputError)
    expect(call(IpcChannel.backupCancelImport)).toBeUndefined()
  })

  it('switches demo mode and keeps backups away from demo data', async () => {
    expect(call(IpcChannel.demoIsEnabled)).toBe(false)
    call(IpcChannel.demoSetEnabled, true)
    expect(call(IpcChannel.demoIsEnabled)).toBe(true)
    expect((call(IpcChannel.habitsList) as unknown[]).length).toBeGreaterThan(0)
    expect(() => call(IpcChannel.backupExport)).toThrow('Turn off demo mode')
    expect(() => call(IpcChannel.backupPickImport)).toThrow('Turn off demo mode')
    expect(() => call(IpcChannel.backupConfirmImport, 'x')).toThrow('Turn off demo mode')
    expect(() => call(IpcChannel.demoSetEnabled, 'yes')).toThrow(InvalidInputError)

    call(IpcChannel.demoSetEnabled, false)
    expect(call(IpcChannel.habitsList)).toEqual([])
  })

  it('returns app info', () => {
    expect(call(IpcChannel.appGetInfo)).toEqual({ name: 'Tally', version: '0.0.0', platform: 'mac' })
  })
})
