# Flowboard validation checklist

Run these checks before publishing a Flowboard change.

## Foundation

- [ ] Open the page with an empty browser storage area; the seeded board renders.
- [ ] Reload after adding a list/card; the change persists.
- [ ] Put valid legacy list-array data under `flowboard-data`, reload, and verify it appears as a migrated board.
- [ ] Put malformed JSON under `flowboard-workspace`, reload, and verify the page does not crash.
- [ ] Open browser DevTools and confirm there are no JavaScript errors.

## Core workflow

- [ ] Rename the board and reload.
- [ ] Rename a list and reload.
- [ ] Add a card with the button and with Enter; use Shift+Enter for a newline.
- [ ] Cancel card creation with Escape.
- [ ] Delete a card and a list; confirm Cancel and destructive-confirmation paths.
- [ ] Drag a card to another list and reload.
- [ ] Add a list and verify focus lands in its title input.
- [ ] Search by a card title, description, label name, checklist item, and assignee; verify the result count and clear action.
- [ ] Open a card and save title, multiline description, named labels, due date/time, assignees, and checklist items; reload and verify every field persists.
- [ ] Mark a checklist item complete and confirm card progress updates after save.
- [ ] Verify upcoming, due-today, overdue, and complete due-state presentation includes readable text.
- [ ] Archive a card, confirm it leaves the active board, then restore it through **Board actions → Archived cards**.
- [ ] Duplicate a card and confirm the copy persists.
- [ ] Open and close the card dialog with the close control and Escape; focus returns to the triggering card.
- [ ] Reset the workspace through Board actions and verify the custom dialog, export-first guidance, and Undo behavior.

## Data safety and portability

- [ ] Export the workspace JSON and verify it is human-readable, has `schemaVersion: 3`, and includes all boards, ordering, and card metadata.
- [ ] Export the active board JSON and card CSV; confirm CSV quotes commas/quotes correctly and includes archived status.
- [ ] In a clean browser storage area, import a workspace export, choose **Replace workspace**, and verify equivalent boards, list/card ordering, and metadata after reload.
- [ ] Import a board export, choose **Merge as a new board**, and verify current data remains while the imported board opens.
- [ ] Select an invalid JSON file and verify the preview rejects it without changing local storage.
- [ ] Test both cancel and confirm paths for replace import; export current data before confirming replacement.
- [ ] Delete a card/list and move a card, then use **Undo**; verify the prior state returns. Confirm undo is clearly session-only after a reload.
- [ ] Make more than five mutations and inspect `flowboard-workspace-backups` in local storage; verify recovery snapshots are bounded.
- [ ] Simulate a storage write failure in DevTools if practical and verify Flowboard clearly advises exporting/checking browser storage.
- [ ] Verify schema 1 and 2 workspace envelopes normalize to schema 3 without a crash.

## Visual and accessibility checks

- [ ] Inspect at desktop width, 700 px, 440 px, and 320 px.
- [ ] Verify board lanes intentionally scroll horizontally without clipping controls.
- [ ] Toggle the theme and inspect contrast, panel separation, and readable text.
- [ ] Tab through top-bar controls, board title, list controls, cards, and dialogs; focus is always visible.
- [ ] Use only keyboard controls for text entry, menu opening, search clear, and dialog confirmation/cancellation.
- [ ] Enable reduced motion in the operating system/browser and verify no disruptive animation remains.
- [ ] Confirm each visible control has an actual behavior or is omitted.

## Release checks

- [ ] `node --check app.js`
- [ ] `git diff --check`
- [ ] `git status --short --branch` is clean after the commit/push.
- [ ] Verify the remote `main` ref matches the intended commit.
- [ ] Smoke-test https://kcchanai.github.io/UH-Trello/ after GitHub Pages completes.
