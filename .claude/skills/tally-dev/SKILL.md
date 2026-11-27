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
    domain/            Pure business logic + unit tests (*.test.ts next to the file)
    api/tally-api.ts   TallyApi contract + IPC channel names
  main/                Electron main process: window, single-instance lock, IPC handlers, storage
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

Data flow: **page → `getApi()` → `window.tally` (preload) → IPC → main → storage**. Domain functions are called from main (to validate and compute) and from the renderer (to display), never with side effects.

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

### Adding a new habit type

1. **Domain** (`src/shared/domain`): add the variant to the target-type union and its config/log value types; implement day evaluation and any streak/rate specifics; add unit tests (edge cases: month/week boundaries, empty logs). The TypeScript `switch` exhaustiveness check will point at every place that needs a case.
2. **Storage** (`src/main`): add a migration if the schema needs new columns; validate the new config at the IPC boundary.
3. **API** (`src/shared/api`): extend types only if the contract changes; keep preload a thin mapping.
4. **UI**: form fields in Manage habits, a log control on Today, a cell renderer in the Month grid, stats in Habit detail; component tests for each.
5. **Demo data**: add an example habit of the new type to the demo seed.
6. Update the table above, `CLAUDE.md` and the README.

## Commands

```bash
npm run dev            # app with hot reload
npm test               # vitest run  (npm run test:watch while developing)
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
