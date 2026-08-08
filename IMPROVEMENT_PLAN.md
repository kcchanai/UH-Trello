# Flowboard Improvement Plan

> Historical roadmap status: Phases 0 through 8 were implemented. This document is retained as product-design history and is no longer the active execution plan. Use [`TERRA_NEXT_PHASES_PLAN.md`](TERRA_NEXT_PHASES_PLAN.md) for current production hardening, lifecycle acceptance, source-budget recovery, and beta readiness.

## Purpose

Evolve the current single-file Trello-style MVP into a polished, dependable board application while preserving its strongest advantage: it is easy to open, understand, deploy, and maintain.

This historical plan deliberately improved the static/local-first product before introducing accounts and Firebase collaboration. Each completed phase left the live GitHub Pages site in a usable state.

## Current baseline

The MVP currently provides:

- One seeded board with horizontally scrolling lists.
- Add, rename, and delete list actions.
- Add and delete card actions.
- Drag-and-drop cards between lists.
- Card-title search.
- Browser-local persistence using `localStorage`.
- Responsive styling and a dependency-free GitHub Pages deployment.

Important limitations to address:

- Cards cannot be edited after creation and contain only a title plus hard-coded metadata.
- Drag-and-drop appends cards to a list but does not support precise ordering.
- Destructive actions are immediate or rely on a browser-native confirmation dialog.
- The interface displays controls such as Star and Share that are not functional.
- There is no multiple-board model, archive, undo, import/export, or data-version migration.
- The current one-file architecture and full-board rerendering will become difficult to maintain as features grow.
- Accessibility, keyboard operation, touch interactions, and automated regression coverage are incomplete.

---

## Product and design principles

1. **Local-first and trustworthy.** Every mutation saves immediately. Users can export, restore, and recover their work.
2. **Fast core loop.** Capturing, editing, moving, and completing a card should require minimal clicks.
3. **Progressive disclosure.** Cards remain visually concise; richer fields appear in a focused detail dialog.
4. **Polished, not derivative.** Retain familiar kanban behavior while establishing a distinct Flowboard visual identity.
5. **Accessible by default.** Keyboard, touch, screen-reader, reduced-motion, and high-contrast use cases are first-class requirements.
6. **Incremental delivery.** Do not begin backend collaboration until the local product and data model are stable.
7. **No deceptive UI.** Every visible control must work; otherwise it should be removed or visibly marked unavailable.

## Target visual direction

- **Personality:** calm, focused, modern, and slightly warmer than Trello.
- **Palette:** deep indigo/blue foundation, soft neutral panels, clear semantic colors, and one warm accent. Use design tokens rather than scattered literal colors.
- **Typography:** system font stack for speed, with a stronger type scale and consistent weights/line heights.
- **Shape:** 10–14 px panels, 8–10 px cards, restrained shadows, and visible focus rings.
- **Density:** comfortable by default, with a future compact mode made possible by tokens.
- **Motion:** 120–200 ms transitions for hover, modal, reorder, and toast feedback; honor `prefers-reduced-motion`.
- **Iconography:** replace emoji and text glyphs with a small, consistent inline SVG icon set.
- **Background:** selectable board color/gradient with enough contrast behind translucent navigation surfaces.

---

# Multi-phase roadmap

## Phase 0 — Stabilize the foundation

**Goal:** Make subsequent implementation safe and maintainable without changing the product’s basic behavior.

### Architecture

- Split the single file into:
  - `index.html` for semantic structure.
  - `styles.css` for design tokens, components, and responsive rules.
  - `app.js` for application state and behavior.
- Keep the project dependency-free and directly deployable by GitHub Pages.
- Introduce a versioned state envelope rather than storing the list array directly:

```js
{
  schemaVersion: 1,
  activeBoardId: "...",
  boards: [/* board objects */],
  preferences: { theme: "system" }
}
```

- Add centralized modules/functions for state loading, validation, migration, mutation, persistence, and rendering.
- Preserve existing `flowboard-data` users through a one-time migration into the new schema.
- Use event delegation instead of attaching handlers to every rerendered card.
- Add stable IDs and timestamps to boards, lists, and cards.
- Add a safe fallback when stored JSON is missing, corrupt, or from an unsupported schema.

### Quality baseline

- Add `README.md` with feature list, local preview steps, deployment URL, limitations, and data-storage explanation.
- Add lightweight automated tests for migration and core state mutations. If avoiding a test dependency, use a small browser test harness; otherwise choose one minimal tool and document it.
- Add a manual regression checklist covering add/edit/delete/move/search/reload/mobile.
- Ensure no inline user content is inserted without escaping or safe DOM APIs.

### Acceptance criteria

- Existing saved MVP data appears after the update.
- A corrupt local-storage value does not blank or crash the page.
- The live board has no console errors.
- Current MVP workflows still pass in desktop and narrow mobile viewports.
- GitHub Pages continues to deploy without a build step.

---

## Phase 1 — Visual system and interaction polish

**Goal:** Establish a cohesive, professional interface before adding large features.

### Design-system work

- Create CSS custom-property groups for color, spacing, typography, radius, elevation, motion, and z-index.
- Implement light and dark themes, defaulting to the operating-system preference and allowing a user override.
- Define reusable styles for buttons, icon buttons, inputs, badges, menus, tooltips, modals, toasts, and skeleton/empty states.
- Improve the top navigation and board toolbar hierarchy:
  - Board title becomes editable.
  - Search gets a clear button and result count.
  - Remove or defer nonfunctional Star/Share controls.
  - Move destructive board actions into an overflow menu.
- Replace emoji/glyph controls with accessible inline SVG icons.
- Improve card spacing, label presentation, hover/focus states, and list-header alignment.
- Add custom scrollbars where supported without harming accessibility.
- Add purposeful empty states for a blank board, list, and search result.

### Interaction polish

- Replace browser `confirm()` with an application confirmation dialog.
- Add toasts with meaningful actions where appropriate.
- Add tooltips only where labels are insufficient.
- Add visible save status: “Saved locally” after mutations and a warning if persistence fails.
- Add contextual list and card menus rather than permanently visible delete buttons.
- Ensure all animations honor reduced-motion preferences.

### Responsive behavior

- Make the board toolbar wrap cleanly at tablet sizes.
- On mobile, retain search through a toolbar action rather than hiding it.
- Increase touch targets to at least 44×44 CSS pixels.
- Account for safe-area insets and mobile browser viewport changes.

### Acceptance criteria

- No visible control is decorative or nonfunctional.
- Light and dark themes both meet WCAG AA contrast for normal text and controls.
- The board remains usable at 320 px width and at common desktop widths.
- Keyboard focus is always visible and logically ordered.
- Visual regression screenshots are captured for desktop, mobile, light, and dark states.

---

## Phase 2 — Complete the card workflow

**Goal:** Turn cards from title-only notes into useful units of work.

### Card detail dialog

Open a modal/drawer when a card is selected. Support:

- Editable title.
- Multiline description.
- Multiple colored labels with editable names.
- Due date and optional due time.
- Checklist items with progress count.
- Assignee initials/avatar placeholders for local use.
- Activity history for local mutations such as created, moved, renamed, and completed.
- Archive and permanent-delete actions separated clearly.

### Card list presentation

- Show label names or compact color bars according to a preference.
- Display due-state semantics: upcoming, due today, overdue, and complete.
- Display checklist completion, description indicator, and assignees.
- Use concise metadata with accessible text—not icon-only meaning.

### Editing and capture

- Support quick card creation with Enter and Shift+Enter behavior.
- Add inline quick-edit for title.
- Allow duplicate card and move-card commands.
- Add optional card templates for recurring work.

### Acceptance criteria

- Every card field persists across reloads.
- Modal focus is trapped, Escape closes safely, and focus returns to the triggering card.
- Archived cards disappear from active lists but remain recoverable.
- Due-state styling does not rely on color alone.
- Long titles/descriptions and empty optional fields render without layout breakage.

---

## Phase 3 — Precise board organization

**Goal:** Make board manipulation feel as capable and predictable as a mature kanban tool.

### Drag, drop, and ordering

- Replace append-only movement with precise insertion before/between cards.
- Support card reorder within the same list.
- Support list reorder across the board.
- Display drop placeholders and clear drag previews.
- Add touch-friendly movement. Prefer pointer events or a well-vetted lightweight drag library only if native behavior cannot meet touch/accessibility requirements.
- Add keyboard move commands as a drag alternative:
  - Move card up/down.
  - Move card to previous/next list.
  - Move list left/right.

### List capabilities

- Add card count and optional work-in-progress limit.
- Add collapse/expand list.
- Add duplicate, archive, and move-all-cards actions.
- Add a “Done” completion behavior without hard-coding a particular list title.

### Search and filtering

- Expand search to title, description, labels, checklist text, and assignee.
- Add filters for label, due state, assignee, completion, and archived state.
- Show active filter chips and a one-click clear action.
- Persist filters only for the current session unless the user explicitly saves a view.

### Acceptance criteria

- Ordering is preserved exactly after reload.
- Dragging works between empty and populated lists, including near scroll boundaries.
- All movement is achievable without a mouse.
- Search/filter results never mutate or reorder underlying data.
- Large boards remain responsive with at least 20 lists and 500 cards in a test fixture.

---

## Phase 4 — Multiple boards and workspace navigation

**Goal:** Move from a single demonstration board to a useful personal planning application.

### Board model

- Add a board switcher/home screen showing board cards.
- Create, rename, duplicate, archive, restore, and permanently delete boards.
- Add board color/gradient and optional background-image preferences.
- Support starred boards as a real feature.
- Persist the active board and recent-board order.

### Workspace experience

- Introduce a compact sidebar/drawer for boards and settings.
- Add templates such as Personal Tasks, Project Launch, Editorial Calendar, and Blank Board.
- Provide a first-run onboarding path rather than always seeding a fixed board silently.
- Add an archived-items view at board and workspace levels.

### Acceptance criteria

- Users can maintain multiple independent boards without data leakage between them.
- Changing or deleting one board never affects another.
- The last active board reopens after reload.
- A first-time user can create a board and first card without instructions.

---

## Phase 5 — Data safety, portability, and recovery

**Goal:** Make browser-local storage credible for real personal use.

### Data controls

- Export all workspace data as human-readable JSON.
- Import JSON with schema validation, preview, and merge/replace choices.
- Add board-level export and import.
- Provide optional CSV export for cards.
- Add a reset workflow that requires explicit confirmation and offers an export first.
- Detect local-storage quota/write errors and communicate them clearly.

### Recovery

- Implement undo for common destructive/movement actions using a bounded action history.
- Add a Recently Deleted/archive area with restore.
- Keep a limited rotating local backup where storage allows.
- Add schema migration tests so future releases do not strand old data.

### Optional installability

- Add a web app manifest and icons.
- Add a minimal service worker for offline shell loading, with careful version/update handling.
- Present installation as optional rather than intrusive.

### Acceptance criteria

- An exported workspace can be imported into a clean browser with equivalent boards, ordering, and metadata.
- Invalid imports do not modify current data.
- Common accidental deletes and moves can be undone.
- The application opens offline after one successful online visit if PWA support is enabled.

---

## Phase 6 — Accessibility and inclusive-use audit

**Goal:** Validate—not merely assume—accessible behavior across the completed local-first feature set.

This work begins in Phase 0 and is continuously enforced; this phase is the formal audit.

### Audit scope

- Semantic headings, landmarks, lists, dialogs, menus, alerts, and labels.
- Full keyboard operation and logical focus order.
- Screen-reader announcements for add, move, archive, delete, filter, and save outcomes.
- Dialog focus management and menu keyboard conventions.
- High contrast, zoom to 200%, text reflow, and color-independent states.
- Reduced motion and coarse-pointer behavior.
- Automated checks with axe/Lighthouse plus manual keyboard and screen-reader passes.

### Acceptance criteria

- No serious or critical automated accessibility findings.
- Core workflows are usable by keyboard only.
- Screen-reader users receive enough context to identify list, card position, and move results.
- Interface remains usable at 200% zoom without lost controls or two-dimensional page scrolling beyond the intentional board lane.

---

## Phase 7 — Optional collaboration platform

**Goal:** Add accounts and shared real-time boards only after the local product and schema are stable.

This phase requires an explicit architecture decision and is not part of the dependency-free static MVP.

### Decision gate

Compare managed platforms such as Supabase and Firebase against a small custom API using:

- Authentication and authorization quality.
- Per-board access control.
- Real-time subscriptions.
- Operational cost and free-tier limits.
- Exportability/vendor lock-in.
- Ease of GitHub Pages integration.
- Auditability and security maintenance burden.

### Collaboration scope

- Account sign-in and sign-out.
- Private, shared, and read-only boards.
- Invite workflow and member roles: owner, editor, viewer.
- Server-side authorization for every board/card mutation.
- Real-time updates with deterministic conflict handling.
- Presence indicators and optional cursor/activity hints.
- Comments, mentions, notifications, and activity audit trail.
- Offline mutation queue with reconciliation.
- Migration/import of an existing local workspace into an account.

### Security requirements

- No secrets embedded in client code beyond intentionally public platform configuration.
- Row/document-level authorization tested against cross-board access.
- Input validation and output encoding at trust boundaries.
- Rate limits and abuse protections for invitations/comments.
- Clear privacy, retention, export, and account-deletion behavior.

### Acceptance criteria

- Two authenticated browsers can update the same board and converge correctly.
- Viewers cannot mutate data through UI or direct API calls.
- Revoked members immediately lose access.
- Local-only users can continue without creating an account if that product choice is retained.

---

## Phase 8 — Performance, testing, and release maturity

**Goal:** Make enhancements safe to ship repeatedly.

### Engineering quality

- Add unit tests for state reducers/mutations, migrations, filtering, import/export, and undo.
- Add browser end-to-end tests for the critical workflows.
- Add automated accessibility checks.
- Add a GitHub Actions workflow for validation on pull requests and `main`.
- Add a deployment smoke check against the GitHub Pages URL.
- Set performance budgets for initial load, interaction latency, and asset size.
- Avoid rerendering the entire board for every small update; progressively adopt targeted DOM updates or a minimal view layer only if profiling justifies it.
- Add release notes and tag stable milestones.

### Acceptance criteria

- Pull requests cannot merge when core tests or accessibility checks fail.
- Critical workflows pass against the deployed site.
- A representative large board remains responsive on a mid-range mobile device.
- No third-party dependency is added without a documented reason, license check, and size/security consideration.

---

# Recommended implementation sequence

## Milestone A — Polished local board

Complete Phases 0–3. This is the highest-value implementation block.

**Result:** A visually polished single board with rich editable cards, precise drag/reorder, keyboard movement, filters, responsive behavior, and a maintainable codebase.

## Milestone B — Personal workspace

Complete Phases 4–6.

**Result:** Multiple boards, templates, import/export, undo/recovery, optional offline installability, and verified accessibility.

## Milestone C — Shared product

Complete Phases 7–8 only after deciding that multi-user collaboration is a real requirement.

**Result:** Authenticated shared boards with authorization, real-time updates, mature tests, and deployment safeguards.

---

# First Terra implementation brief

For the next implementation session, Terra should execute **Phase 0 plus the core of Phase 1** as one bounded release:

1. Create `styles.css` and `app.js`; keep `index.html` semantic and compact.
2. Introduce the versioned workspace/board/list/card data model and migrate existing `flowboard-data` automatically.
3. Add safe state loading, validation, mutation helpers, persistence-error feedback, and event delegation.
4. Build design tokens, polished light/dark themes, consistent inline SVG controls, and visible focus states.
5. Make the board title editable and remove/defer nonfunctional controls.
6. Replace native destructive confirmation with an accessible custom dialog.
7. Preserve every existing functional workflow.
8. Add `README.md` and a repeatable manual/browser validation checklist.
9. Test migration, add/rename/delete/move/search/reload, narrow viewport, keyboard focus, themes, and console cleanliness.
10. Commit and publish only after the live GitHub Pages build is verified.

## Explicit non-goals for the first Terra release

- No backend, authentication, or real-time sync.
- No framework migration unless a concrete blocker is demonstrated.
- No rich card-detail modal yet; prepare the model for it, then implement it in Phase 2.
- No decorative controls that imply unavailable functionality.

---

# Definition of done for every phase

A phase is complete only when:

- Its acceptance criteria are exercised, not merely coded.
- Existing workflows are regression-tested.
- Desktop and mobile layouts are visually inspected.
- Keyboard behavior and focus states are checked.
- JavaScript console output is clean.
- Persistent data survives reload and schema changes.
- Documentation reflects the actual behavior and limitations.
- The repository is clean, committed, pushed, and the deployed GitHub Pages site is smoke-tested.
