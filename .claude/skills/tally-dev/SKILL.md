---
name: tally-dev
description: How to work on Tally, the macOS habit and challenge tracker (Electron + electron-vite + React + TypeScript). Use whenever you start or continue work in this repo, add or change a habit type, touch streaks/limits/scoring, add a screen, change storage or the preload API, run tests or typecheck, build or install the Mac app (npm run install:mac), or create an issue, branch, commit or PR for Tally.
---

# Working on Tally

Read `CLAUDE.md` first: its authorship and Git rules are mandatory (sole author Deyner Higuera, no AI attribution anywhere, never commit to `main`, never merge PRs).

## Architecture

```
src/
  shared/              Platform-independent code (no Electron, Node, React)
    domain/            Pure business logic + unit tests (*.test.ts next to the file), 100% coverage enforced
      date.ts          IsoDate helpers, weekStartOf (Monday), eachDay, logicalDateOf (04:00 rollover)
      time.ts          TimeOfDay (HH:mm), minutesFromGoal, formatMinutesFromGoal
      habit.ts         Habit, HabitTarget, LogValue, HabitLog types + validateTarget / validateLogValue
      evaluate.ts      evaluateDay / evaluateRange → DayStatus, indexLogs, weekCountThrough
      stats.ts         currentStreak, bestStreak, successRate, averageMinutesFromGoal, scaleTrend
      test-helpers.ts  makeHabit / makeLogs for tests only
    api/
      tally-api.ts         TallyApi contract (= HabitRepository + app info) + IPC channel names
      habit-repository.ts  HabitRepository: the storage contract the UI depends on
      parse.ts             Runtime parsers for untrusted input (IPC args, imported files)
      memory-repository.ts In-memory HabitRepository with the same rules (UI tests, future web build)
      backup.ts            Backup file format: createBackup, parseBackup (strict validation), summarizeBackup
  main/                Electron main process
    index.ts           Window, single-instance lock, creates DataSources, registers IPC
    data-sources.ts    DataSources: real tally.db + demo.db while demo mode is on
    settings-store.ts  SettingsStore: typed settings.json (demoMode, showInMenuBar); tolerant of old or broken files
    tray-summary.ts    buildTraySummary(habits, logs, today) → menu bar title ("3/7") and items (pure, tested)
    tray.ts            TrayController: Electron Tray with a template icon; menu rebuilt on every click
    reminder.ts        isReminderDue / reminderMessage: pure daily-reminder rules (tested)
    ipc-handlers.ts    createIpcHandlers(store): channel → parse args → store (no Electron imports, tested)
    db/database.ts     openDatabase(path) + MIGRATIONS (PRAGMA user_version)
    db/habit-store.ts  HabitStore: synchronous SQLite queries for habits and logs (+ exportAll / replaceAll)
    backup-service.ts  BackupService: export to file, two-step import (pickImport → confirmImport), FileDialogs injected
  preload/             Maps TallyApi → ipcRenderer.invoke, exposes it as window.tally (CJS, sandboxed)
  renderer/
    index.html         CSP lives here
    src/
      main.tsx         <ApiProvider api={getApi()}> + HashRouter
      api/client.ts    getApi(): the ONLY place that reads window.tally
      api/ApiProvider.tsx, api/useApi.ts   React context: screens call useApi(), never window.tally
      AppRoutes.tsx    Routes: / (Today, ?date=YYYY-MM-DD for past days), /month (?month=YYYY-MM), /habits, /habits/new, /habits/:id, /habits/:id/edit, /settings
      components/      Shared UI pieces (Layout, StatusPill, TrendChart, …)
      components/log-controls/  One control per target type (Check, Counter, Time, Scale), all take LogControlProps
      pages/           One file per screen + its *.test.tsx
      lib/             UI helpers: format.ts (labels, describeTarget, formatDayTitle), status.ts (statusLabel), month.ts (month params, monthDays, cellText), errors.ts (errorMessage), today.ts
      test/render.tsx  renderApp(path, repository): full app with an in-memory repository
      styles.css       Plain CSS with variables; light and dark via prefers-color-scheme
build/                 icon.svg → icon.png and tray.svg → resources/trayTemplate(@2x).png (`npm run icon`)
resources/             Files shipped inside the app (menu bar icon); listed in electron-builder `files`
scripts/               install-mac.sh, render-icon.sh
test/setup.ts          Testing Library matchers
```

Data flow: **page → `getApi()` → `window.tally` (preload) → IPC → `parse.ts` → `HabitStore` → SQLite**.

### Demo mode

- `src/shared/demo/demo-data.ts` → `createDemoData(today)`: deterministic example data (8 habits covering every target type + 1 archived, 90 days). Update it when adding a habit type.
- `DataSources` (main) keeps the real store always open and, while demo mode is on, a separate `demo.db` that is rebuilt every time demo mode turns on and deleted when it turns off. IPC handlers resolve `sources.active()` on every call. The flag lives in `userData/settings.json`, so demo mode survives restarts.
- Anything that must never touch demo data (backups, imports) calls `sources.assertNotDemo(action)`. `BackupService` always works on `sources.real`.
- UI: `useDemo()` (from `DemoProvider`) gives `{ enabled, setEnabled }`; the sidebar shows a "Demo data" badge.
- Screenshots for the README and videos: always take them in demo mode, with the badge visible.
- **Retaking README screenshots** (`docs/screenshots/*.png`, 1600 px wide): `npm run build`, run `electron . --remote-debugging-port=9333`, turn on demo mode with the **Settings** switch (not through `tally.demo` directly, so the badge updates), then capture each route with the DevTools protocol (`Page.captureScreenshot`; `Emulation.setEmulatedMedia` with `prefers-color-scheme: dark` for the dark shot) and resize with `sips -Z 1600`. Turn demo mode off afterwards. Check every image before committing.

### Menu bar and preferences

- Preferences that are not habit data live in `settings.json` via `SettingsStore`, never in the database (so imports don't change them). **New preference** → add it to `Settings` + `DEFAULT_SETTINGS`, to `Preferences` in `tally-api.ts` if the UI edits it, and to `parsePreferencesChange`.
- The menu bar title refreshes after every channel in `DATA_CHANGING_CHANNELS` (`tally-api.ts`) and when the habit day rolls over at 04:00 (checked every minute). A test fails if a new write channel is missing from that set.
- Tray icons must be _template images_ (black + alpha, file name ending in `Template`) so macOS tints them for light and dark menu bars.
- Closing the window keeps the app running (macOS convention); `openWindow()` in `index.ts` recreates it. A second launch from Spotlight also calls `openWindow()`.

### Daily reminder

- Settings `reminderEnabled` + `reminderTime` (`HH:mm`, default 21:00). A one-minute ticker in `index.ts` calls `isReminderDue`: due from the reminder time until 60 minutes later, at most once per calendar day (kept in memory). The ticker also refreshes the menu bar at the 04:00 rollover.
- The message uses `TraySummary.open` (to do + unlogged scale habits). Nothing is sent when everything is logged.
- Clicking the notification calls `openWindow('/')`. An open window gets the `RendererEvent.navigate` event and `Layout` navigates (only paths starting with `/`). A closed window is recreated with that route as its hash.
- Known limit: the catch-up window does not cross midnight, so a 23:30 reminder missed during sleep is skipped after 00:00.
- Notifications from `npm run dev` show as "Electron"; the installed app shows "Tally". macOS asks for permission the first time; **Send test notification** in Settings triggers it.

### Backups

- Format: `{ app: 'tally', schemaVersion, exportedAt, habits, logs }`, habits in display order. `BACKUP_SCHEMA_VERSION` lives in `src/shared/api/backup.ts`.
- **Changing the data shape** (new habit field, new log value): bump `BACKUP_SCHEMA_VERSION` and teach `parseBackup` to read every older version, with a test that imports an old file. Never break old backups.
- Import is two steps: `pickImport` validates the whole file and keeps it in memory behind a token; `confirmImport(token)` writes a safety copy to `userData/backups/before-import-*.json` and then calls `HabitStore.replaceAll` in one transaction.
- `BackupService` gets its dialogs injected (`FileDialogs`), so tests run with real temp files and fake dialogs.

### UI conventions

- Screens get data with `const api = useApi()` and call `api.habits.*` / `api.logs.*`. Show failures with `errorMessage(e)` in a `role="alert"` element.
- Today's date always comes from `today()` in `lib/today.ts` (04:00 rollover), never `new Date()` directly.
- UI tests: `renderApp('/route', createMemoryRepository({ habits, logs }))`, then query by role and label (Testing Library). Every form control has a visible label.
- Labels for kinds and target types live in `lib/format.ts`; reuse them instead of hard-coding strings.
- Status wording comes from `statusLabel(target, status)` in `lib/status.ts` (limits say "Within limit" / "Over limit", times say "Late").
- Load data in an effect with an `active` flag and bump a `refresh` counter after writes (see `TodayPage`); this keeps the React hooks lint rules happy.
- Habit detail (`/habits/:id`): stat tiles come from `src/shared/domain/stats.ts`; archived habits are measured up to the day before `archivedDate`. Scale habits without a rule show averages instead of streaks.
- Charts: hand-written SVG, no chart library. Follow the dataviz rules: one series → no legend (the caption names it), 2px line, 8px dots with a surface ring, gaps for missing days, crosshair + tooltip that also works with arrow keys, a "Show as table" view, and labels outside the plot. The series color is `--chart-line` (validated for light and dark surfaces).
- Month grid: load logs from `weekStartOf(first day)` so weekly limits count the days of the first week that fall in the previous month. Cells link to `/?date=…` to edit that day. `.content` has `min-width: 0` so wide tables scroll instead of stretching the layout.
- Log controls clear the log instead of storing an "empty" value: unchecking a check, a counter back to 0, an emptied time, or pressing the selected scale level again.

### Storage

- SQLite via Node's built-in `node:sqlite` (`DatabaseSync`), so there's no native module to rebuild for Electron, and Vitest uses the same engine.
- File: `~/Library/Application Support/Tally/tally.db` (installed app) or `…/Tally Dev/tally.db` (`npm run dev`). WAL mode, foreign keys on.
- Tables: `habits` (target stored as JSON, `position` for order, `archived_date`) and `logs` (primary key `habit_id, date`, value stored as JSON).
- Logs are upserted: one value per habit per day. Habits are archived, never deleted. A habit's target _type_ can't change after creation.
- **Schema change** → append SQL to `MIGRATIONS` in `src/main/db/database.ts`, add a test, never edit a shipped migration. An app opening a DB from a newer schema refuses with a clear error.
- **New IPC call** → add the method to `HabitRepository` (or `TallyApi`), a channel in `IpcChannel`, a parser in `parse.ts` if it takes input, the handler in `ipc-handlers.ts` (the "every channel has a handler" test catches misses) and the mapping in `src/preload/index.ts`.
- Main-process tests start with `// @vitest-environment node` and use `openDatabase(':memory:')`. Domain functions are called from main (to validate and compute) and from the renderer (to display), never with side effects.

Boundaries are enforced by ESLint `no-restricted-imports`:

- `src/shared/**` cannot import `electron`, `node:*`, `react`.
- `src/renderer/**` cannot import `electron` or `node:*`.

Path aliases: `@shared/*` → `src/shared/*`, `@renderer/*` → `src/renderer/src/*`.

## Habit model

Each habit has a **kind** and a **target type**:

| Target type  | Value logged        | Success when                                                |
| ------------ | ------------------- | ----------------------------------------------------------- |
| Daily check  | done / not done     | done (BUILD)                                                |
| Daily limit  | count               | count ≤ N that day                                          |
| Weekly limit | count               | week total ≤ N (weeks start Monday)                         |
| Target time  | `HH:mm`             | at or before the goal; show minutes early/late              |
| Daily scale  | 1–5 + optional note | matches optional "good if ≤/≥ X" rule; no rule → trend only |

Rules: unlogged day on a BREAK limit counts as 0 (success); unlogged BUILD check / target time is a miss; times before 04:00 belong to the previous day; today never breaks a streak until it is over.

Scoring is decided by the **target type**, not the kind. The kind (`BUILD` / `BREAK`) is how the habit is framed in the UI. A daily check always means "done = success", so word BREAK checks positively ("No sugar today").

`DayStatus` values returned by `evaluateDay`:

| Status                  | Meaning                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `success` / `fail`      | Decided day. Counts toward streaks and the success rate            |
| `pending`               | Today, not decided yet. Skipped by streaks, so it never breaks one |
| `tracked` / `untracked` | Scale habit without a rule: logged or not. No streak               |
| `inactive`              | Before `startDate` or from `archivedDate` on                       |
| `future`                | After today                                                        |

Weekly limits are scored per day: a day fails when the week total up to that day is over the limit, so the rest of that week shows as failed. Limits within range today are `pending`; going over fails at once.

Storage keeps logs as `HabitLog { habitId, date, value }`. Index one habit's logs with `indexLogs()` before calling the evaluation and stats functions. Pass `today` explicitly; use `logicalDateOf(new Date())` to get it.

### Adding a new habit type

1. **Domain** (`src/shared/domain`): add the variant to the target-type union and its config/log value types; implement day evaluation and any streak/rate specifics; add unit tests (edge cases: month/week boundaries, empty logs). The TypeScript `switch` exhaustiveness check will point at every place that needs a case.
2. **Storage**: targets and values are JSON, so usually no migration is needed. Extend `parseTarget` / `parseLogValue` in `src/shared/api/parse.ts` and their tests.
3. **API** (`src/shared/api`): extend types only if the contract changes; keep preload a thin mapping.
4. **UI**: form fields in `HabitFormPage`, a control in `components/log-controls` wired in `TodayPage`'s `LogControl` switch, a mark in `cellText` / `describeValue` (`lib/month.ts`), a cell renderer in the Month grid, stats in Habit detail; component tests for each.
5. **Demo data**: add an example habit of the new type to `createDemoData` (its test checks every target type is covered).
6. Update the table above, `CLAUDE.md` and the README.

## Commands

```bash
npm run dev            # app with hot reload
npm test               # vitest run  (npm run test:watch while developing)
npm run test:coverage  # with coverage; fails if src/shared/domain drops below 100% (CI runs this)
npm run typecheck      # tsc for node (main/preload/shared) and web (renderer) projects
npm run lint           # eslint
npm run format:check   # prettier (npm run format to fix)
npm run install:mac    # build → ad-hoc sign → strip quarantine → replace /Applications/Tally.app
```

Run lint, format:check, typecheck and tests before every push; CI runs the same on every PR.

`install:mac` never touches user data (`~/Library/Application Support/Tally`). After installing, open with Cmd + Space → "Tally".

## Git flow (every change)

1. **Issue**: `gh issue create --milestone MVP --label <label>` (or use the existing one).
2. **Branch** from an up-to-date `main`: `git switch main && git pull && git switch -c feat/<short-name>`.
3. **Small commits**, conventional and in English: `feat: add weekly limit evaluation`. Stage explicit paths, never blind `git add .`. No `Co-Authored-By` or AI lines.
4. **Push and open a PR**: `git push -u origin <branch>` then
   `gh pr create --title "feat: …" --body "…"` with sections **What**, **Why**, **How to test**, and `Closes #n`. English, no AI attribution.
5. **Stop.** The owner reviews and merges. Do not merge.
6. After the merge: `git switch main && git pull`, delete the local branch, start the next issue.

## Keep this skill current

Update this file in the same PR whenever folders, commands, the habit model or the workflow change.
