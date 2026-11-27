import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRepository } from '@shared/api/memory-repository'
import type { ImportPreview, TallyApi } from '@shared/api/tally-api'
import { renderApp } from '../test/render'

const preview: ImportPreview = {
  token: 'tok-1',
  fileName: 'tally-backup-2026-11-27.json',
  summary: {
    exportedAt: '2026-11-27T10:00:00.000Z',
    habits: 8,
    archivedHabits: 1,
    logs: 210,
    firstDate: '2026-11-01',
    lastDate: '2026-11-27',
  },
  current: { habits: 7, logs: 1 },
}

function backupApi(overrides: Partial<TallyApi['backup']> = {}): TallyApi['backup'] {
  return {
    export: vi.fn(async () => ({ saved: true as const, path: '/Users/me/Documents/tally-backup.json' })),
    pickImport: vi.fn(async () => preview),
    confirmImport: vi.fn(async () => ({ safetyBackupPath: '/data/backups/before-import.json' })),
    cancelImport: vi.fn(async () => undefined),
    ...overrides,
  }
}

const renderSettings = (backup: TallyApi['backup']) =>
  renderApp('/settings', createMemoryRepository(), { backup })

describe('SettingsPage: backup', () => {
  it('exports a backup and shows where it was saved', async () => {
    const backup = backupApi()
    renderSettings(backup)
    await userEvent.click(screen.getByRole('button', { name: 'Export backup…' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Backup saved to /Users/me/Documents/tally-backup.json',
    )
  })

  it('says nothing when the save dialog is cancelled', async () => {
    const backup = backupApi({ export: vi.fn(async () => ({ saved: false as const })) })
    renderSettings(backup)
    await userEvent.click(screen.getByRole('button', { name: 'Export backup…' }))
    expect(backup.export).toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('previews an import and replaces data only after confirming', async () => {
    const user = userEvent.setup()
    const backup = backupApi()
    renderSettings(backup)

    await user.click(screen.getByRole('button', { name: 'Import backup…' }))
    const region = within(await screen.findByRole('region', { name: 'Import preview' }))
    expect(region.getByText('tally-backup-2026-11-27.json')).toBeInTheDocument()
    expect(
      region.getByText(/Contains 8 habits \(1 archived\) and 210 logs, from Nov 1 to Nov 27/),
    ).toBeInTheDocument()
    expect(region.getByText(/replaces all current data \(7 habits and 1 log\)/)).toBeInTheDocument()
    expect(backup.confirmImport).not.toHaveBeenCalled()

    await user.click(region.getByRole('button', { name: 'Replace my data' }))
    expect(backup.confirmImport).toHaveBeenCalledWith('tok-1')
    expect(await screen.findByRole('status')).toHaveTextContent('/data/backups/before-import.json')
    expect(screen.queryByRole('region', { name: 'Import preview' })).not.toBeInTheDocument()
  })

  it('cancels an import', async () => {
    const user = userEvent.setup()
    const backup = backupApi()
    renderSettings(backup)
    await user.click(screen.getByRole('button', { name: 'Import backup…' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(backup.cancelImport).toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Import preview' })).not.toBeInTheDocument()
  })

  it('shows why a file was rejected', async () => {
    const backup = backupApi({
      pickImport: vi.fn(async () => {
        throw new Error(
          "Error invoking remote method 'backup:pick-import': InvalidInputError: This file is not a Tally backup.",
        )
      }),
    })
    renderSettings(backup)
    await userEvent.click(screen.getByRole('button', { name: 'Import backup…' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This file is not a Tally backup.')
  })
})
