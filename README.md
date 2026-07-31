# Flowboard

A lightweight, local-first project-planning board inspired by kanban tools. It is a static HTML/CSS/JavaScript site with no dependencies or build step.

**Live site:** https://kcchanai.github.io/UH-Trello/

## Current capabilities

- Seeded project board with horizontally scrollable lists.
- Create, rename, and delete lists.
- Create and delete cards.
- Drag cards between lists.
- Filter cards across titles, descriptions, labels, checklist text, and assignees.
- Open an accessible card-detail dialog to edit titles, descriptions, named colored labels, due dates/times, checklists, and local assignees.
- See concise card metadata: description, checklist progress, due state, labels, and assignee initials.
- Archive cards and restore them from **Board actions → Archived cards**; permanent deletion remains separate.
- Undo the most recent common change (including deletes, moves, resets, and imports) while the page stays open.
- Export the full workspace or active board as readable JSON, and export active-board cards as CSV.
- Preview valid Flowboard JSON before importing, then merge it as a new board or explicitly replace the workspace.
- Keep up to five rotating local recovery backups when browser storage allows; storage write failures are surfaced clearly.
- Reset the workspace only through an explicit custom confirmation that recommends exporting first.
- Record a local activity history for creation, editing, moves, archive/recovery, and duplication.
- Duplicate a card from its detail view.
- Edit the board title.
- Light/dark visual themes.
- Accessible native dialogs with labelled content, Escape dismissal, and focus returned to the initiating control.
- Semantic landmarks, a skip-to-board link, card lists with screen-reader card positions, and live announcements for saves, filters, and mutations.
- Keyboard-operable board-action menu (Arrow keys, Home/End, Escape), card details, keyboard card movement, and 44 px coarse-pointer targets.
- Forced-colors/high-contrast support, 200% reflow safeguards, and reduced-motion support.
- Browser-local persistence and migration from the original MVP storage format.
- A tested `LocalWorkspaceAdapter` boundary. The application does not bypass it for browser persistence, and unavailable cloud operations fail explicitly rather than imitating sign-in or sync.
- Honest cloud-configuration status: until Supabase's public project configuration and server policies are supplied, Flowboard remains local-only.
- A per-board **Collaboration plan** that records planned owner/editor/viewer roles and access mode locally, plus a clearly labelled local viewer-preview guard. It does not provide accounts, invitations, server authorization, or sync.

## Run locally

Clone/download the repository, install the locked development dependencies, then use Vite's local server:

```bash
git clone https://github.com/kcchanai/UH-Trello.git
cd UH-Trello
npm ci
npm run dev
```

Vite serves the project at `http://127.0.0.1:5173/UH-Trello/` by default. `npm run build` creates the deployable static site in `dist/`; GitHub Actions publishes that built directory to GitHub Pages.

## Data and privacy

Flowboard stores data only in this browser using `localStorage`; it has no accounts, collaboration backend, or cloud synchronization. The local **Collaboration plan** is planning metadata and a UI-only viewer preview, not identity or access control. Export a workspace JSON file before clearing browser-site data or moving browsers. The app uses a versioned `flowboard-workspace` storage envelope (currently schema 4), automatically migrates the original `flowboard-data` MVP format, and keeps up to five rotating browser-local recovery snapshots where storage space permits. Undo history is intentionally session-only. Imports are parsed and validated before the user chooses merge or replacement; invalid data leaves the current workspace untouched. A browser-local backup is helpful recovery—not a substitute for exported copies.

## Project structure

- `index.html` — semantic page structure, accessible dialog, and SVG icon sprite.
- `styles.css` — responsive design system, components, light/dark themes, and reduced-motion support.
- `app.js` — UI orchestration and DOM event handling; persistence is delegated to the configured local adapter.
- `src/main.js` — Vite module entry that assembles runtime configuration, the domain helpers, and adapters.
- `src/adapters/` — documented adapter contract, explicit unavailable-cloud boundary, and `LocalWorkspaceAdapter`.
- `src/config.js` — public environment configuration detection; it exposes no credentials.
- `state-core.js` — dependency-free state helpers shared by the app and Node unit tests.
- `tests/` — Node unit tests and Chromium critical-workflow smoke tests.
- `.github/workflows/validate.yml` — pull-request/main validation: unit, static, performance-budget, browser, and accessibility checks.
- `RELEASE_NOTES.md` — release notes, dependency decision, budgets, and repeatable release commands.
- `IMPROVEMENT_PLAN.md` — prioritized product and design roadmap.
- `VALIDATION_CHECKLIST.md` — repeatable acceptance checks.
- `COLLABORATION_ARCHITECTURE.md` — Phase 7 decision record, safe integration boundary, server-side security requirements, and release gates.

## Deployment

GitHub Actions validates the project, builds it with Vite, and publishes the generated `dist/` directory to GitHub Pages. The production build uses the `/UH-Trello/` base path. After pushing changes, open the live site above once the GitHub Pages workflow completes.

## Quality and release checks

Run the dependency-free checks locally with:

```bash
npm test
npm run check
```

GitHub Actions runs those checks for pull requests and `main`, then installs Playwright and Lighthouse ephemerally for Chromium critical-workflow and automated accessibility validation. They are CI-only tools: the deployed app remains dependency-free. The release gate also enforces an initial 140 KB budget for all initial HTML/CSS/JS assets and per-file ceilings; details and the documented dependency/license decision are in `RELEASE_NOTES.md`.

## Accessibility

Flowboard is designed for keyboard and assistive-technology use: use the skip link to reach the board, **Enter** to open a card, **Alt + Arrow keys** to move a focused card, and Arrow keys/Home/End/Escape in **Board actions**. Native dialogs contain their focus while open and return it when closed. Cards announce their list and visible position; save, filter, add, move, archive, delete, and undo outcomes are announced through a polite live region.

The Phase 6 audit used Lighthouse accessibility against the locally served app (score: **100**, no failed audits), plus practical browser checks for dialog focus return, menu keyboard behavior, a keyboard-created persisted card, 200% zoom/reflow, reduced-motion CSS, and desktop visual layout. Browser-local storage and drag-and-drop remain local-only; no screen-reader testing can substitute for testing with a user’s chosen assistive technology.

## Collaboration status and next work

Phase 7 now has a versioned local collaboration-plan data model, a functional local viewer preview, and a documented Supabase-oriented architecture decision. It is **not** real collaboration: this repository has no backend project/configuration or credentials, so accounts, invitations, server-side access control, realtime updates, presence, comments, notifications, offline reconciliation, and cross-browser convergence are blocked. `COLLABORATION_ARCHITECTURE.md` specifies the required configuration, security model, migration flow, and acceptance tests before an authenticated backend implementation should begin.
