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
  main/                Electron main process
    index.ts           Window, single-instance lock, opens the DB, registers IPC
    ipc-handlers.ts    createIpcHandlers(store): channel → parse args → store (no Electron imports, tested)
    db/database.ts     openDatabase(path) + MIGRATIONS (PRAGMA user_version)
    db/habit-store.ts  HabitStore: synchronous SQLite queries for habits and logs
  preload/             Maps TallyApi → ipcRenderer.invoke, exposes it as window.tally (CJS, sandboxed)
  renderer/
    index.html         CSP lives here
    src/
      api/client.ts    getApi(): the ONLY place the UI reads window.tally
      AppRoutes.tsx    React Router routes (HashRouter in production, MemoryRouter in tests)
      components/      Shared UI pieces (Layout, …)
      pages/           One file per screen: Today, Month, Habits, HabitDetail, Settings
build/                 icon.svg (source) → icon.png (rendered with `npm run icon`)
scripts/               install-mac.sh, render-icon.sh
test/setup.ts          Testing Library matchers
```

Data flow: **page → `getApi()` → `window.tally` (preload) → IPC → `parse.ts` → `HabitStore` → SQLite**.

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
4. **UI**: form fields in Manage habits, a log control on Today, a cell renderer in the Month grid, stats in Habit detail; component tests for each.
5. **Demo data**: add an example habit of the new type to the demo seed.
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
