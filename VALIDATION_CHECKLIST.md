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

## Cloud workspace lifecycle

- [x] Application lifecycle presentation tests pass for owner, editor, viewer, active, and archived states.
- [x] Firestore Emulator tests pass for owner-only rename/archive/restore, invalid lifecycle denial, archived content denial, frozen member/invitation mutations, migration compatibility, and continued hard-delete denial.
- [x] Browser tests cover rename, retained-data archive confirmation, Escape cancellation, focus return, archived non-openability, restore, and non-owner control absence.
- [x] At mobile width, archived rows retain their visible workspace name and `archived · retained` status with Restore associated to the same row while Open, Rename, and Archive remain absent.
- [x] Restoring an archived row immediately restores its Open, Rename, and Archive controls without hiding the workspace identity.
- [x] Full local validation passes with 20 application/tooling tests, 23 Rules tests, 9 browser checks, syntax/static checks, production build, and the unchanged source budget.
- [x] Built lifecycle-dialog regression displays the exact stale-session message, leaves the dialog recoverable, and proves the losing name is not applied.
- [x] Sync-controller regression proves archive-style `permission-denied` stops listeners exactly once, returns to local mode, ignores late callbacks, and does not reconnect on the next online event.
- [x] Interrupted granular migration recovery is owner-readable, viewer-denied, revision-safe for partial writes, and Emulator-tested without direct Console data repair.
- [x] Publish and production-test the interrupted-migration recovery release, then retry the retained lifecycle fixture to `ready` before archive/restore acceptance.
- [x] Publish the source-controlled Rules only after release approval and record the deployed Rules source revision.
- [x] Verify owner archive, automatic local fallback, retained archived presentation, owner Restore, restored cloud descendants, and visual return to the unchanged local baseline using only `Lifecycle acceptance renamed`.
- [ ] Verify production owner rename convergence in an independent authenticated browser context without refresh, then prove a stale lifecycle mutation returns `REVISION_CONFLICT` without writing.
- [ ] Verify an owner archive in one context stops the other context's listeners, returns it to unchanged local data, and causes no reconnect loop.
- [ ] Verify editor/viewer/non-member/former-member/revoked-member lifecycle denial through production Rules, not only hidden controls.
- [x] Verify archive and restore leave `flowboard-workspace` and `flowboard-data` byte-for-byte unchanged. Production evidence retained `flowboard-workspace` at exactly 8,539 bytes and retained `flowboard-data` as absent.
- [ ] Restore the production workspace and remove or archive any acceptance fixtures through supported lifecycle operations.

## Phase H production release and privacy

- [x] Run sanitized direct probes from authenticated browser sessions plus the anonymous REST harness; never copy or retain tokens, credentials, emails, UIDs, opaque document identifiers, or full payloads.
- [x] Record direct workspace/board/card/comment/activity reads and cross-workspace denial.
- [x] Record direct viewer/non-member write denial and malformed/forged-ID denial.
- [x] Verify hard deletion of cloud parents and comments is denied; verify card archive and comment soft-removal retention.
- [x] Verify revocation during an active card session stops listeners and subsequent direct reads/writes.
- [x] Verify conflict, offline/reconnect, sign-out, and local restoration behavior.
- [x] Document Firebase/Google identity use, membership visibility, exports, retention, leave/removal, deletion restrictions, redacted diagnostics, and the UH/institutional-data boundary.
- [x] Recheck Firebase Spark pricing, quotas, terms, and hawaii.edu organization policy before beta.
- [x] Record the manually published production Rules source revision and exact source commit.

## Visual and accessibility checks

- [x] Inspect at desktop width, 700 px, 440 px, and 320 px.
- [x] Verify board lanes intentionally scroll horizontally without clipping controls.
- [x] Toggle the theme and inspect contrast, panel separation, and readable text.
- [x] Tab through the skip link, top-bar controls, board title, list controls, cards, and dialogs; focus is always visible.
- [x] Use only keyboard controls for text entry, menu opening (Arrow keys/Home/End/Escape), search clear, card opening, Alt+Arrow card movement, and dialog confirmation/cancellation.
- [x] Verify card buttons announce title, list, and position; verify save/add/move/archive/delete/filter/undo outcomes reach the polite live region.
- [x] Open every dialog, verify the first useful control receives focus, press Escape, and confirm focus returns to the initiating control.
- [x] Test at 200% zoom and 320 px width: no control is lost and only the intentional board lane scrolls horizontally.
- [x] Enable forced colors/high contrast and reduced motion; verify borders/focus remain legible and no disruptive animation remains.
- [x] Run Lighthouse against the built release; require accessibility score 1 and no failed audits.
- [x] Confirm each visible control has an actual behavior or is omitted.

## Release checks

- [x] `node --check app.js`
- [x] `git diff --check`
- [x] `git status --short --branch` is clean after the commit/push.
- [x] Verify the remote `main` ref matches the intended commit.
- [x] Smoke-test https://kcchanai.github.io/UH-Trello/ after GitHub Pages completes.
