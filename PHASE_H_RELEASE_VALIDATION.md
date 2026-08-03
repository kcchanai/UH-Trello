# Phase H release, privacy, and direct authorization validation

## Status

Phase H is in progress. G3 Rules publication and owner/editor/viewer UI acceptance are complete. The remaining release gate is direct Firestore authorization from separate production identities, followed by revocation, conflict/offline, privacy, accessibility, quota, and release evidence.

Production project: `flowboard-504105`

Current deployed client: see the latest `main` commit and its GitHub Pages cache-busted release URL.

Production Rules publication evidence must record the Firebase Console active revision and the exact source-controlled Rules commit. The G3 Rules revision was manually published before Phase H began.

## Automated validation evidence - 2026-08-02

Aaron ran the complete local non-Emulator chain from PowerShell through `cmd.exe`:

```text
npm test && npm run check && npm run build && git diff --check
```

Recorded result:

- application tests: 13 passed, 0 failed;
- syntax/static validation: passed;
- semantic/runtime guards and adapter-boundary checks: passed;
- performance budget: 199,522 of 210,000 bytes;
- production Vite build: passed;
- `git diff --check`: passed with no output.

Aaron separately ran `npm.cmd run test:rules`. The Java-backed Firestore Emulator suite reported 21 passed, 0 failed, and script exit code 0. The subsequent Firestore Emulator `SIGINT` was its normal post-success shutdown.

Committed release-validation workflows for `7ed19732d9034edf883bfc06a649a607b05a0103` also passed:

- Validate Flowboard `30779765774`: success;
- Deploy Flowboard to GitHub Pages `30779765823`: success.

These results establish the automated layer only. They do not replace the separate production owner/editor/viewer/non-member direct-authorization matrix.

## Safety boundary

- Use a dedicated test workspace and a dedicated active test card for any positive direct API mutation.
- Do not use production content that is not explicitly designated for testing.
- Do not paste Firebase ID tokens, Google credentials, cookies, API keys, invite links, or screenshots containing sensitive values into chat, issues, commits, or logs.
- The direct REST probe prints statuses only and never prints response bodies or bearer tokens.
- Firestore hard deletion of cloud parents and comments is denied. Use soft removal or archive for cleanup.
- Local browser data must remain unchanged throughout every cloud test.

## Direct Firestore probe

`scripts/phase-h-direct-access.mjs` performs authenticated reads and intentional negative writes without using Firebase Admin credentials.

Required local-only environment variables:

```text
FLOWBOARD_ACCESS_TOKEN
FLOWBOARD_WORKSPACE_ID
FLOWBOARD_BOARD_ID
FLOWBOARD_CARD_ID
```

Optional:

```text
FLOWBOARD_PROJECT_ID
FLOWBOARD_TAMPER_WORKSPACE_ID
```

Run it only in a local shell and retain the token in process environment, not a file:

```bash
FLOWBOARD_ACCESS_TOKEN='local-token-not-for-chat' \
FLOWBOARD_WORKSPACE_ID='dedicated-test-workspace' \
FLOWBOARD_BOARD_ID='dedicated-test-board' \
FLOWBOARD_CARD_ID='dedicated-test-card' \
FLOWBOARD_TAMPER_WORKSPACE_ID='different-workspace-id' \
node scripts/phase-h-direct-access.mjs
```

Expected results for a member token:

- workspace read: HTTP 200;
- board read: HTTP 200;
- card read: HTTP 200;
- bounded comment collection read with `pageSize=25`: HTTP 200;
- cross-workspace workspace read: HTTP 403;
- stale direct card write: HTTP 403;
- malformed direct comment write: HTTP 403.

Run the probe with owner, editor, viewer, and non-member tokens. For the non-member, the member reads and collection read must be HTTP 403. A token must never be considered evidence of identity unless its Firebase Auth account is independently verified in the test record.

## Direct Firestore SDK checks from a signed-in production browser

The deployed app exposes the authenticated adapter object for its own runtime, but not the Firebase Auth token. These calls bypass the UI controls while retaining the signed-in browser session. Run them from that account's DevTools console and record only pass/fail and redacted error codes.

First open the dedicated test card and capture opaque IDs locally:

```js
const H = {
  workspaceId: FlowboardApp.getMode().id,
  boardId: FlowboardApp.getActiveBoardId(),
  cardId: document.querySelector('#card-dialog').dataset.cardId
};
H
```

Owner or editor direct positive comment lifecycle, using a dedicated test card:

```js
const commentId = await FlowboardRuntime.cloudAdapter.createComment({...H, body:'Phase H direct SDK owner/editor probe'});
await FlowboardRuntime.cloudAdapter.updateComment({...H, commentId, revision:0, body:'Phase H direct SDK edited'});
await FlowboardRuntime.cloudAdapter.removeComment({...H, commentId, revision:1});
commentId
```

The final operation is soft removal. It must leave no active comment body and must create the matching privacy-minimal activity record.

Viewer and non-member negative probes:

```js
await FlowboardRuntime.cloudAdapter.createComment({...H, body:'Phase H viewer write must fail'});
await FlowboardRuntime.cloudAdapter.fetchWorkspace(H.workspaceId);
```

For a viewer, both calls must reject with permission denial. For a non-member, `fetchWorkspace` must reject. A viewer may also attempt `updateComment` and `removeComment` against a known test comment; both must reject.

Cross-workspace and malformed-ID probes use a different known workspace ID and deliberately forged board/card IDs. Do not use an administrator console write as evidence because administrator access bypasses Security Rules.

The browser SDK path does not test an unbounded or over-limit query because the client normalizes its page size. Use the local-only REST probe for that Rules-specific check and never place its bearer token in chat, files, or logs.

## Required production matrix

Record only pass/fail, timestamp, account role, workspace/card test identifiers, HTTP status, and redacted error category.

### Owner

- Read workspace, board, card, bounded comments, and activity.
- Create and edit a dedicated test comment through the direct authenticated client path.
- Remove that comment through the supported soft-removal path.
- Manage a test member role without minting an owner.
- Attempt forged member, board, card, comment, and activity identifiers.
- Attempt hard deletion of workspace, board, list, card, and comment. Every attempt must fail.
- Attempt ownership transfer as a complete approved operation only on a dedicated test workspace.
- Confirm last-owner removal and partial-transfer attempts fail.

### Editor

- Read workspace, board, card, bounded comments, and activity.
- Create and edit an own-author test comment through the direct authenticated client path.
- Attempt to edit or remove an owner-authored comment. Must fail.
- Attempt membership, invite, ownership, and activity update/delete operations. Must fail.
- Attempt cross-workspace and forged-ID reads/writes. Must fail.
- Attempt hard deletion of every cloud parent and comment. Must fail.

### Viewer

- Read workspace, board, card, bounded comments, and activity.
- Attempt card/list/board/comment/activity writes directly. Every attempt must fail.
- Attempt collection reads without an explicit bounded limit and above the maximum. Must fail.
- Attempt cross-workspace and forged-ID reads. Must fail.
- Confirm UI read-only behavior independently, including pointer-accessible dialog closure.

### Non-member

- Attempt workspace, board, card, comment, activity, member, invite, and profile-linked workspace reads. Must fail unless the operation is explicitly intended for a public invitation surface.
- Attempt every write category. Must fail.
- Attempt access using another valid member's workspace, board, card, comment, and activity IDs. Must fail.

## Revocation and active-session checks

1. Keep an editor or viewer session signed in with the cloud card open.
2. From the owner account, remove the member or change the role.
3. Confirm the affected session loses the active listener and privileged controls without a reload.
4. Confirm subsequent direct reads and writes fail with permission denial.
5. Return to local mode and confirm the browser-local workspace is intact and unchanged.
6. Reinvite or restore the role only through the supported owner workflow when the test is complete.

## Offline, conflict, and local isolation

- Use two browser sessions on different cards and verify convergence.
- Edit the same card from both sessions with a stale revision. Confirm conflict handling and no silent overwrite.
- Disconnect one browser before a mutation. Confirm the UI does not claim `Synced` for an uncommitted write.
- Reconnect and verify either authoritative convergence or an explicit rollback/conflict outcome.
- Sign out while a cloud card is open. Confirm listeners stop and local data remains available.
- No persistent Firestore disk cache or offline mutation queue is permitted in this release.

## Privacy and lifecycle record

Before beta, document in user-facing policy copy or the release notes:

- Google/Firebase account identity used for authentication;
- workspace membership visibility to current workspace members;
- comment and activity retention, including soft removal;
- export behavior and local backup-first behavior;
- workspace leave, member removal, and ownership transfer behavior;
- deletion restrictions and archived-card retention;
- redaction of emails, tokens, invite IDs, comment bodies, and document contents from diagnostics;
- the decision that institutional, FERPA-covered, employment, or other controlled data is not authorized without separate UH approval;
- Firebase pricing, Spark quotas, terms, and hawaii.edu organization-policy review before beta.

## Product release checks

- Local-only regression suite passes.
- Cloud/local switching and export checks pass.
- Owner/editor/viewer UI acceptance passes.
- Direct API matrix passes for all four identities.
- Revocation and active-session checks pass.
- Conflict and offline checks pass.
- 573 px, 320 px, 200% zoom, forced colors, reduced motion, keyboard, and dialog focus checks pass.
- Lighthouse accessibility score is 1 with no failed audits.
- Initial and lazy Firestore bundle budgets pass.
- Firestore read/write/listener audit is recorded against current Spark quotas.
- GitHub Pages deployment and cache-busted production console check pass.

Phase H is complete only when every item above has dated evidence. A passing UI test alone is not direct Firestore authorization proof.
