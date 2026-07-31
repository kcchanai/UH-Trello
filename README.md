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

Flowboard currently stores data only in this browser using `localStorage`. It has no accounts, collaboration, backend, or cloud synchronization. Clearing browser-site data clears Flowboard data. The app uses a versioned `flowboard-workspace` storage envelope and automatically migrates the original `flowboard-data` MVP format when it finds it.

## Project structure

- `index.html` — semantic page structure, accessible dialog, and SVG icon sprite.
- `styles.css` — responsive design system, components, light/dark themes, and reduced-motion support.
- `app.js` — state schema, storage migration/validation, rendering, event delegation, and board interactions.
- `IMPROVEMENT_PLAN.md` — prioritized product and design roadmap.
- `VALIDATION_CHECKLIST.md` — repeatable acceptance checks.

## Deployment

GitHub Pages serves `index.html` from the `main` branch root. After pushing changes, open the live site above once the GitHub Pages build completes.

## Planned next work

The next roadmap milestone is precise board organization: insertion-aware card/list reordering, touch and keyboard movement, and expanded filters. See `IMPROVEMENT_PLAN.md` for the complete phased plan.
