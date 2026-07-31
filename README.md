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
- Accessible custom confirmation dialog for destructive actions.
- Browser-local persistence and migration from the original MVP storage format.

## Run locally

Clone/download this repository, then open `index.html` in a modern browser. A local server is optional because the application has no build step.

```bash
git clone https://github.com/kcchanai/UH-Trello.git
cd UH-Trello
# Open index.html in your browser
```

## Data and privacy

Flowboard stores data only in this browser using `localStorage`; it has no accounts, collaboration, backend, or cloud synchronization. Export a workspace JSON file before clearing browser-site data or moving browsers. The app uses a versioned `flowboard-workspace` storage envelope (currently schema 3), automatically migrates the original `flowboard-data` MVP format, and keeps up to five rotating browser-local recovery snapshots where storage space permits. Undo history is intentionally session-only. Imports are parsed and validated before the user chooses merge or replacement; invalid data leaves the current workspace untouched. A browser-local backup is helpful recovery—not a substitute for exported copies.

## Project structure

- `index.html` — semantic page structure, accessible dialog, and SVG icon sprite.
- `styles.css` — responsive design system, components, light/dark themes, and reduced-motion support.
- `app.js` — state schema, storage migration/validation, rendering, event delegation, and board interactions.
- `IMPROVEMENT_PLAN.md` — prioritized product and design roadmap.
- `VALIDATION_CHECKLIST.md` — repeatable acceptance checks.

## Deployment

GitHub Pages serves `index.html` from the `main` branch root. After pushing changes, open the live site above once the GitHub Pages build completes.

## Planned next work

The next roadmap milestone is the formal accessibility and inclusive-use audit: automated and manual checks for keyboard, screen-reader, high-contrast, zoom, and reduced-motion behavior. See `IMPROVEMENT_PLAN.md` for the complete phased plan.
