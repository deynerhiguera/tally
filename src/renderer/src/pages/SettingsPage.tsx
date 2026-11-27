import { useState } from 'react'
import type { ImportPreview } from '@shared/api/tally-api'
import { useApi } from '../api/useApi'
import { errorMessage } from '../lib/errors'
import { formatShortDate } from '../lib/format'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function formatExportedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))
}

export function SettingsPage() {
  return (
    <section>
      <header className="page-header">
        <h1>Settings</h1>
      </header>
      <BackupSection />
    </section>
  )
}

function BackupSection() {
  const api = useApi()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const exportBackup = () =>
    run(async () => {
      const result = await api.backup.export()
      if (result.saved) setMessage(`Backup saved to ${result.path}`)
    })

  const pickImport = () =>
    run(async () => {
      setPreview(await api.backup.pickImport())
    })

  const confirmImport = (token: string) =>
    run(async () => {
      const { safetyBackupPath } = await api.backup.confirmImport(token)
      setPreview(null)
      setMessage(`Backup imported. Your previous data was saved to ${safetyBackupPath}`)
    })

  const cancelImport = () =>
    run(async () => {
      await api.backup.cancelImport()
      setPreview(null)
    })

  const summary = preview?.summary

  return (
    <section className="panel" aria-label="Backup">
      <h2>Backup</h2>
      <p className="muted">
        Your data lives only on this Mac. Export a backup now and then and keep it somewhere safe, like iCloud
        Drive.
      </p>

      <div className="button-row">
        <button type="button" onClick={() => void exportBackup()} disabled={busy}>
          Export backup…
        </button>
        <button type="button" onClick={() => void pickImport()} disabled={busy || preview !== null}>
          Import backup…
        </button>
      </div>

      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {preview && summary && (
        <div className="import-preview" role="region" aria-label="Import preview">
          <p>
            <strong>{preview.fileName}</strong>
            <span className="muted"> · exported {formatExportedAt(summary.exportedAt)}</span>
          </p>
          <p>
            Contains {plural(summary.habits, 'habit')}
            {summary.archivedHabits > 0 && ` (${summary.archivedHabits} archived)`} and{' '}
            {plural(summary.logs, 'log')}
            {summary.firstDate &&
              summary.lastDate &&
              `, from ${formatShortDate(summary.firstDate)} to ${formatShortDate(summary.lastDate)}`}
            .
          </p>
          <p className="warning">
            Importing replaces all current data ({plural(preview.current.habits, 'habit')} and{' '}
            {plural(preview.current.logs, 'log')}). A copy of the current data is saved first.
          </p>
          <div className="button-row">
            <button type="button" onClick={() => void cancelImport()} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => void confirmImport(preview.token)}
              disabled={busy}
            >
              Replace my data
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
