# CLAUDE.md — Tally

Tally is a personal habit and challenge tracker, shipped as a native-feeling macOS app
(Electron + electron-vite + React + TypeScript). It is a public, build-in-public project.

For day-to-day "how do I work on this" guidance, load the project skill:
`.claude/skills/tally-dev/SKILL.md`.

> These project rules **override** the global `~/.claude/CLAUDE.md` where they differ
> (PR language and template, branch names without HU-XXX, no AI attribution).

---

## Authorship — non-negotiable

- The only author is **Deyner Higuera** (GitHub `deynerhiguera`). Commits use the local Git identity; never change `git config user.name` / `user.email`.
- **Never** add `Co-Authored-By` trailers, "Generated with Claude Code" lines, or any AI attribution to commits, PR titles, PR descriptions, issues or code comments.
- `gh` must be on the `deynerhiguera` account (`gh auth status`). If another account is active, stop and ask before switching.

## Git and GitHub workflow

- `main` is always releasable. **Never commit directly to `main`.**
- One branch per issue: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `test/…`, `refactor/…` (kebab-case, no HU numbers).
- Conventional commits in English, imperative, ≤ 72 chars, no trailing period:
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `style:`, `perf:`, `ci:`.
- Small commits that each do one thing. Stage files explicitly; show what is staged.
- Flow for every feature: **GitHub issue → branch → small commits → `gh pr create` → the owner reviews and merges → `git switch main && git pull` → next branch.**
- PRs: in English, link the issue with `Closes #n`, and a short description with three sections: **What**, **Why**, **How to test**.
- **Never merge PRs.** Never force-push `main`. Ask before the first push of a new branch if unsure.
- Milestones: `MVP`, `Post-MVP`. Labels: `domain`, `ui`, `electron`, `data`, `tooling`, `documentation`.

## Commands

| Command                           | What it does                                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                     | Run the app in development with hot reload                               |
| `npm test`                        | Vitest (domain + UI tests)                                               |
| `npm run typecheck`               | `tsc` for main/preload/shared and renderer projects                      |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                        |
| `npm run build`                   | Build main, preload and renderer into `out/`                             |
| `npm run package:mac`             | Build `release/mac-arm64/Tally.app`                                      |
| `npm run install:mac`             | Build, ad-hoc sign, remove quarantine, replace `/Applications/Tally.app` |
| `npm run icon`                    | Re-render `build/icon.png` from `build/icon.svg`                         |

Before opening a PR: `npm run lint && npm run format:check && npm run typecheck && npm test`.

## Architecture rules

- `src/shared/domain` is **pure TypeScript**: no Electron, Node, React or DOM imports (enforced by ESLint). All business logic (streaks, limits, scoring) lives here and is unit tested.
- `src/shared/api` defines the `TallyApi` contract. The renderer talks to the platform **only** through `window.tally` via `src/renderer/src/api/client.ts`. The renderer never imports `electron` or `node:*` (enforced by ESLint).
- `src/main` owns windows, IPC handlers and storage. `src/preload` only maps `TallyApi` to IPC channels.
- Storage: SQLite (`better-sqlite3`) in the main process, at `~/Library/Application Support/Tally/`. Never store user data inside the `.app` bundle.
- Single-instance app; security defaults: `contextIsolation`, `sandbox`, no `nodeIntegration`, CSP in `index.html`.
- TypeScript strict (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

## Habit model

- Kind: `BUILD` (do it) or `BREAK` (stay inside a limit).
- Target types: daily check, daily limit (≤ N/day), weekly limit (≤ N/week), target time (vs goal, minutes early/late), daily scale 1–5 (+ note).
- Agreed rules: weeks start Monday; unlogged day on a BREAK limit = success; unlogged BUILD check / target time = miss; times before 04:00 belong to the previous day; scale habits have an optional "good if ≤/≥ X" rule (no rule → trend only); today never breaks a streak until it is over.

## Keep docs in sync

When the architecture, commands or habit model change, update this file, the skill (`.claude/skills/tally-dev/SKILL.md`) and the README in the same PR.
