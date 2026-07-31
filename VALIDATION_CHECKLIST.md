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
- [ ] Reset the board through Board actions and verify the custom dialog.

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
