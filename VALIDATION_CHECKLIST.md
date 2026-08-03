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

- [ ] Export the workspace JSON and verify it is human-readable, has `schemaVersion: 4`, and includes all boards, ordering, card metadata, and local collaboration-plan metadata.
- [ ] Export the active board JSON and card CSV; confirm CSV quotes commas/quotes correctly and includes archived status.
- [ ] In a clean browser storage area, import a workspace export, choose **Replace workspace**, and verify equivalent boards, list/card ordering, metadata, and collaboration-plan data after reload.
- [ ] Import a board export, choose **Merge as a new board**, and verify current data remains while the imported board opens.
- [ ] Select an invalid JSON file and verify the preview rejects it without changing local storage.
- [ ] Test both cancel and confirm paths for replace import; export current data before confirming replacement.
- [ ] Delete a card/list and move a card, then use **Undo**; verify the prior state returns. Confirm undo is clearly session-only after a reload.
- [ ] Make more than five mutations and inspect `flowboard-workspace-backups` in local storage; verify recovery snapshots are bounded.
- [ ] Simulate a storage write failure in DevTools if practical and verify Flowboard clearly advises exporting/checking browser storage.
- [ ] Verify schema 1, 2, and 3 workspace envelopes normalize to schema 4 without a crash.

## Firebase authentication and cloud-copy safety

- [ ] Sign in with Google on the deployed GitHub Pages URL; verify account initials, session reload persistence, and sign-out.
- [ ] Confirm sign-in alone leaves the browser workspace local-only and leaves `flowboard-workspace` unchanged.
- [ ] Open **Create cloud copy**, verify the local count/size preview, and download the timestamped JSON backup before cloud writes are enabled.
- [ ] Create the cloud copy, verify the returned board count/IDs, and confirm the header says **Cloud copy · local** with its full tooltip/accessibility explanation.
- [ ] Refresh at the reported 573 px responsive width; the exact post-copy status has no horizontal truncation.
- [ ] Confirm local boards/cards remain present and editable after the cloud copy completes.

## Firebase authorization gates before member UI

- [ ] `npm run test:rules` passes against the Firestore Emulator.
- [ ] Emulator tests cover anonymous denial, workspace isolation, owner/editor/viewer boundaries, protected owner membership, self-leave, invitation email verification/expiry/revocation/single-use, and atomic ownership transfer.
- [ ] Materially changed `firestore.rules` are published to production before invitation/member UI is exposed.
- [ ] Separate real Google accounts verify owner/editor/viewer/non-member direct Firestore access after each production rule publication.
- [ ] Keep `COLLABORATION_ARCHITECTURE.md` and `TERRA_NEXT_PHASES_PLAN.md` current; client UI is never treated as authorization.

## Phase H production release and privacy

- [ ] Run `scripts/phase-h-direct-access.mjs` locally with a dedicated test workspace for owner, editor, viewer, and non-member tokens; keep tokens out of files, chat, and logs.
- [ ] Record direct workspace/board/card/comment/activity reads and cross-workspace denial.
- [ ] Record direct viewer/non-member write denial and malformed/forged-ID denial.
- [ ] Verify hard deletion of cloud parents and comments is denied; verify card archive and comment soft-removal retention.
- [ ] Verify revocation during an active card session stops listeners and subsequent direct reads/writes.
- [ ] Verify conflict, offline/reconnect, sign-out, and local restoration behavior.
- [ ] Document Firebase/Google identity use, membership visibility, exports, retention, leave/removal, deletion restrictions, redacted diagnostics, and the UH/institutional-data boundary.
- [ ] Recheck Firebase Spark pricing, quotas, terms, and hawaii.edu organization policy before beta.
- [ ] Record the published Firestore Rules revision and exact source commit.

## Visual and accessibility checks

- [ ] Inspect at desktop width, 700 px, 440 px, and 320 px.
- [ ] Verify board lanes intentionally scroll horizontally without clipping controls.
- [ ] Toggle the theme and inspect contrast, panel separation, and readable text.
- [ ] Tab through the skip link, top-bar controls, board title, list controls, cards, and dialogs; focus is always visible.
- [ ] Use only keyboard controls for text entry, menu opening (Arrow keys/Home/End/Escape), search clear, card opening, Alt+Arrow card movement, and dialog confirmation/cancellation.
- [ ] Verify card buttons announce title, list, and position; verify save/add/move/archive/delete/filter/undo outcomes reach the polite live region.
- [ ] Open every dialog, verify the first useful control receives focus, press Escape, and confirm focus returns to the initiating control.
- [ ] Test at 200% zoom and 320 px width: no control is lost and only the intentional board lane scrolls horizontally.
- [ ] Enable forced colors/high contrast and reduced motion; verify borders/focus remain legible and no disruptive animation remains.
- [ ] Run `npx --yes lighthouse http://127.0.0.1:4173/ --only-categories=accessibility --chrome-flags='--headless --no-sandbox'` against a local `python -m http.server 4173`; require score 1 and no failed audits.
- [ ] Confirm each visible control has an actual behavior or is omitted.

## Release checks

- [ ] `node --check app.js`
- [ ] `git diff --check`
- [ ] `git status --short --branch` is clean after the commit/push.
- [ ] Verify the remote `main` ref matches the intended commit.
- [ ] Smoke-test https://kcchanai.github.io/UH-Trello/ after GitHub Pages completes.
