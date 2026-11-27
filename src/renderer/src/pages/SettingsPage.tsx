import { useEffect, useState } from 'react'
import type { ImportPreview, Preferences } from '@shared/api/tally-api'
import { isTimeOfDay } from '@shared/domain/time'
import { useApi } from '../api/useApi'
import { useDemo } from '../api/useDemo'
import { errorMessage } from '../lib/errors'
import { formatShortDate } from '../lib/format'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function formatExportedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))
}

export function SettingsPage() {
  const preferences = usePreferences()
  return (
    <section>
      <header className="page-header">
        <h1>Settings</h1>
      </header>
      <ReminderSection {...preferences} />
      <MenuBarSection {...preferences} />
      <DemoSection />
      <BackupSection />
    </section>
  )
}

interface PreferencesState {
  /** Null until loaded. */
  prefs: Preferences | null
  error: string | null
  update(change: Partial<Preferences>): Promise<void>
}

function usePreferences(): PreferencesState {
  const api = useApi()
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.preferences.get().then(
      (loaded) => active && setPrefs(loaded),
      (e: unknown) => active && setError(errorMessage(e)),
    )
    return () => {
      active = false
    }
  }, [api])

  async function update(change: Partial<Preferences>) {
    setError(null)
    try {
      setPrefs(await api.preferences.update(change))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return { prefs, error, update }
}

function ReminderSection({ prefs, error, update }: PreferencesState) {
  const api = useApi()
  const [draftTime, setDraftTime] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const time = draftTime ?? prefs?.reminderTime ?? ''

  function commitTime() {
    if (draftTime === null || !prefs) return
    setDraftTime(null)
    if (draftTime !== prefs.reminderTime && isTimeOfDay(draftTime)) void update({ reminderTime: draftTime })
  }

  async function sendTest() {
    setTestMessage(null)
    try {
      await api.reminder.test()
      setTestMessage(
        'Test notification sent. If nothing appeared, allow notifications for Tally in System Settings → Notifications.',
      )
    } catch (e) {
      setTestMessage(errorMessage(e))
    }
  }

  return (
    <section className="panel" aria-label="Daily reminder">
      <div className="toggle-row">
        <div>
          <h2>Daily reminder</h2>
          <p className="muted">
            A notification at the time you choose, when some habits are still open that day. Click it to go
            straight to Today.
          </p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={prefs?.reminderEnabled === true}
            disabled={prefs === null}
            onChange={(e) => void update({ reminderEnabled: e.target.checked })}
          />
          <span>Remind me</span>
        </label>
      </div>
      <div className="reminder-row">
        <label className="field-inline">
          <span>Time</span>
          <input
            type="time"
            value={time}
            disabled={!prefs?.reminderEnabled}
            onChange={(e) => setDraftTime(e.target.value)}
            onBlur={commitTime}
            onKeyDown={(e) => e.key === 'Enter' && commitTime()}
          />
        </label>
        <button type="button" onClick={() => void sendTest()} disabled={prefs === null}>
          Send test notification
        </button>
      </div>
      {testMessage && (
        <p role="status" className="muted">
          {testMessage}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  )
}

function MenuBarSection({ prefs, update }: PreferencesState) {
  return (
    <section className="panel" aria-label="Menu bar">
      <div className="toggle-row">
        <div>
          <h2>Menu bar</h2>
          <p className="muted">
            Shows today's progress (like 3/7) next to a Tally icon in the menu bar. Click it to see each
            habit's status and open Tally.
          </p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={prefs?.showInMenuBar === true}
            disabled={prefs === null}
            onChange={(e) => void update({ showInMenuBar: e.target.checked })}
          />
          <span>Show in menu bar</span>
        </label>
      </div>
    </section>
  )
}

function DemoSection() {
  const { enabled, setEnabled } = useDemo()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(next: boolean) {
    setBusy(true)
    setError(null)
    try {
      await setEnabled(next)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel" aria-label="Demo mode">
      <div className="toggle-row">
        <div>
          <h2>Demo mode</h2>
          <p className="muted">
            Shows example habits and 90 days of fake history, for screenshots and videos. Your real data is
            not shown or changed while it is on. Demo data is reset every time you turn it on.
          </p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={enabled === true}
            disabled={enabled === null || busy}
            onChange={(e) => void toggle(e.target.checked)}
          />
          <span>Use demo data</span>
        </label>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
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
