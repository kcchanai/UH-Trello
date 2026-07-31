# Flowboard

A lightweight, local-first project-planning board inspired by kanban tools. It uses vanilla HTML/CSS/JavaScript with a small Vite build and an adapter boundary for optional Firebase collaboration.

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
- Real Firebase Google sign-in with persistent browser sessions, account status, and sign-out; authentication never implies authorization or automatic data migration.
- A backup-first, explicit cloud-copy flow that reviews board/list/card counts, downloads JSON before enabling upload, creates owner membership under deployed Firestore Security Rules, verifies the written boards, and keeps the local original active.
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

Flowboard's active board remains browser-local in `localStorage` unless the signed-in user separately reviews and confirms **Create cloud copy**. Sign-in alone never uploads, merges, replaces, or deletes local data. The migration flow requires a downloaded JSON backup, creates a separate Firestore workspace and owner membership, verifies the cloud board documents, and leaves the local original active; realtime synchronization and cloud editing are not enabled yet. The local **Collaboration plan** remains planning metadata and a UI-only viewer preview, not server authorization. The app uses a versioned `flowboard-workspace` storage envelope (currently schema 4), automatically migrates the original `flowboard-data` MVP format, and keeps up to five rotating browser-local recovery snapshots where storage permits. Undo history is session-only. Imports are validated before merge or replacement; invalid data leaves the current workspace untouched.

## Project structure

- `index.html` — semantic page structure, accessible dialog, and SVG icon sprite.
- `styles.css` — responsive design system, components, light/dark themes, and reduced-motion support.
- `app.js` — UI orchestration and DOM event handling; persistence is delegated to the configured local adapter.
- `src/main.js` — Vite module entry that assembles runtime configuration, the domain helpers, and adapters.
- `src/adapters/` — documented adapter contract, `LocalWorkspaceAdapter`, Firebase Authentication adapter, and lazy-loaded Firestore cloud-workspace migration adapter.
- `src/config.js` — public environment configuration detection; it exposes no credentials.
- `state-core.js` — dependency-free state helpers shared by the app and Node unit tests.
- `firebase.json`, `firestore.rules`, and `firestore.indexes.json` — deployed Firestore policy source plus Emulator Suite configuration; rules remain version-controlled and tested in CI.
- `FIREBASE_COLLABORATION_PLAN.md` — active authenticated-collaboration roadmap.
- `FIREBASE_OWNER_SETUP.md` — exact owner-only Firebase console setup and credential-safety checklist.
- `tests/` — Node unit tests, Firestore Security Rules tests, and Chromium critical-workflow smoke tests.
- `.github/workflows/validate.yml` — pull-request/main validation: unit, static, performance-budget, browser, and accessibility checks.
- `RELEASE_NOTES.md` — release notes, dependency decision, budgets, and repeatable release commands.
- `IMPROVEMENT_PLAN.md` — prioritized product and design roadmap.
- `VALIDATION_CHECKLIST.md` — repeatable acceptance checks.
- `COLLABORATION_ARCHITECTURE.md` — Phase 7 decision record, safe integration boundary, server-side security requirements, and release gates.

## Deployment

GitHub Actions validates the project, builds it with Vite, and publishes the generated `dist/` directory to GitHub Pages. The production build uses the `/UH-Trello/` base path. After pushing changes, open the live site above once the GitHub Pages workflow completes.

## Quality and release checks

Run the local application checks with:

```bash
npm test
npm run check
npm run build
```

Firestore Security Rules tests additionally require Java 21 and use a disposable Emulator Suite project:

```bash
npm run test:rules
```

GitHub Actions runs all of these checks for pull requests and `main`, then installs Playwright and Lighthouse ephemerally for Chromium critical-workflow and automated accessibility validation. The deployed client includes the pinned Firebase Web SDK only when cloud integration is implemented; Firebase CLI and browser test tools are not production runtime dependencies.

## Accessibility

Flowboard is designed for keyboard and assistive-technology use: use the skip link to reach the board, **Enter** to open a card, **Alt + Arrow keys** to move a focused card, and Arrow keys/Home/End/Escape in **Board actions**. Native dialogs contain their focus while open and return it when closed. Cards announce their list and visible position; save, filter, add, move, archive, delete, and undo outcomes are announced through a polite live region.

The Phase 6 audit used Lighthouse accessibility against the locally served app (score: **100**, no failed audits), plus practical browser checks for dialog focus return, menu keyboard behavior, a keyboard-created persisted card, 200% zoom/reflow, reduced-motion CSS, and desktop visual layout. Browser-local storage and drag-and-drop remain local-only; no screen-reader testing can substitute for testing with a user’s chosen assistive technology.

## Collaboration status and next work

Phase A established the local adapter and Vite/GitHub Pages build. Firebase Google Authentication is live, deny-by-default Firestore rules are deployed, and rules tests run in CI. The current migration stage can create and verify a separate owner-controlled cloud copy only after an explicit local JSON backup; it deliberately does not switch the active local workspace or silently synchronize data. This is **not yet live collaboration**: cloud editing, workspace switching, invitations, role administration, revocation, and realtime synchronization remain release-gated. See `FIREBASE_COLLABORATION_PLAN.md` for the roadmap.
