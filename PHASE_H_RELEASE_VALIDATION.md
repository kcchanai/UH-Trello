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

## Production direct-authorization evidence

### Owner direct SDK lifecycle - PASS - 2026-08-02

Tested against deployed release `df70d2ba52f60327f1ec931fb9abed0628acd96c` from an authenticated owner browser session through `FlowboardRuntime.cloudAdapter`, bypassing comment UI controls.

Recorded result:

- direct comment creation: allowed;
- direct revision-checked own-comment edit: allowed;
- direct revision-checked soft removal: allowed;
- final operation completed without hard deletion;
- no credentials, token, document ID, or full error object was recorded.

This establishes the owner positive comment lifecycle only. Editor cross-author denial, viewer denial, non-member denial, cross-workspace isolation, raw query bounds, revocation, and remaining Phase H checks are still pending.

### Editor direct SDK lifecycle and cross-author boundary - PASS - 2026-08-02

Tested against deployed release `df70d2ba52f60327f1ec931fb9abed0628acd96c` from an authenticated editor browser session through `FlowboardRuntime.cloudAdapter`.

Recorded result:

- direct own-comment creation: allowed;
- direct revision-checked own-comment edit: allowed;
- direct revision-checked own-comment soft removal: allowed;
- direct edit of an active owner-authored comment: denied with `permission-denied`;
- direct removal of an active owner-authored comment: denied with `permission-denied`;
- final editor probe result: pass;
- no Firebase configuration value, token, UID, workspace ID, board ID, card ID, comment ID, mutation ID, response body, or full error object was retained in this record.

The first cross-author probe selected the editor's newly soft-removed comment while its deletion timestamp was resolving and returned the client-side `COMMENT_UNAVAILABLE` precondition. The corrected probe selected a different author with `authorUid != current session UID` and `deletedAt == null`, then obtained the required server-side permission denials.

This establishes the editor positive and cross-author comment boundaries. Viewer denial, non-member denial, cross-workspace isolation, raw query bounds, revocation, and remaining Phase H checks are still pending.

### Viewer direct SDK read/write boundary - PASS - 2026-08-02

Tested against the deployed Phase H client from an authenticated viewer browser session through `FlowboardRuntime.cloudAdapter`, bypassing comment UI controls.

Recorded result:

- bounded direct comment collection read with page size 25: allowed;
- direct comment creation: denied with production authorization;
- direct active-comment edit: denied with production authorization;
- direct active-comment soft removal: denied with production authorization;
- final viewer probe result: pass;
- no Firebase configuration value, token, UID, workspace ID, board ID, card ID, comment ID, mutation ID, response body, or full error object was retained in this record.

This establishes the viewer direct comment boundary. Non-member denial, cross-workspace isolation, raw query bounds, revocation, and remaining Phase H checks are still pending.

### Non-member direct SDK read/write boundary - PASS - 2026-08-02

Tested from an authenticated Firebase account with no membership in the valid production test workspace, using locally transferred opaque document identifiers and `FlowboardRuntime.cloudAdapter`.

Recorded result:

- direct workspace reconstruction/read: denied;
- direct bounded comment collection read: denied;
- direct workspace activity read: denied;
- direct workspace member collection read: denied;
- direct comment creation: denied;
- final non-member probe result: pass;
- no Firebase configuration value, token, account identity, UID, workspace ID, board ID, card ID, comment ID, mutation ID, response body, or full error object was retained in this record.

Because this used a real valid workspace against an identity outside that workspace, it establishes valid-workspace isolation for the non-member role. Forged identifiers, raw query bounds, revocation, and remaining Phase H checks are still pending.

### Forged workspace and nested parent identifiers - PASS - 2026-08-02

Tested from an authenticated owner session with cryptographically random, nonexistent workspace, board, and card identifiers through `FlowboardRuntime.cloudAdapter`.

Recorded result:

- forged workspace reconstruction/read: denied;
- forged workspace activity read: denied;
- valid-workspace comment read through forged board/card parents: denied;
- valid-workspace comment creation through forged board/card parents: denied;
- final forged-identifier probe result: pass;
- no Firebase configuration value, token, account identity, UID, production document ID, forged identifier, response body, or full error object was retained in this record.

This establishes fail-closed behavior for forged workspace and nested comment-parent identifiers. Raw query bounds, hard-delete denial, ownership/former-owner boundaries, revocation, and remaining Phase H checks are still pending.

### Anonymous direct REST boundary - PASS - 2026-08-02

Tested with `FLOWBOARD_ANONYMOUS=YES` against the valid dedicated production test workspace, board, and card. No bearer token or authenticated browser session was supplied.

Recorded result:

- workspace read: denied with HTTP 403;
- board read: denied with HTTP 403;
- card read: denied with HTTP 403;
- bounded comment collection read with page size 25: denied with HTTP 403;
- over-limit comment collection read with page size 26: denied with HTTP 403;
- unbounded comment collection read: denied with HTTP 403;
- stale direct card write: denied with HTTP 403;
- malformed direct comment write: denied with HTTP 403;
- probe result: 8 of 8 passed;
- output target remained redacted and no configuration value, token, account identity, UID, production document ID, response body, or full error object was retained.

This establishes anonymous production denial for direct reads and writes. Because all anonymous reads are denied regardless of query shape, authenticated member evidence is still required to distinguish `limit(25)` allow from `limit(26)` and unbounded denial.

### Authenticated comment query bounds - PASS - 2026-08-02

Tested from a signed-in owner browser session through the deployed read-only `probeCommentQueryAuthorization` adapter diagnostic against the dedicated production test card.

Recorded result:

- explicit query limit 25: allowed;
- explicit query limit 26: denied with `permission-denied`;
- query with no explicit limit: denied with `permission-denied`;
- probe sentinel: `AUTHENTICATED QUERY BOUNDS PASS`;
- no token, account identity, UID, Firebase configuration value, production document ID, comment body, response body, or full error object was retained.

A trailing browser-console message stated that an asynchronous listener returned true but its message channel closed before a response arrived. That is browser runtime/extension message-channel wording, not a Firestore Rules authorization result. It did not replace or invalidate the probe's explicit pass sentinel. Attribution can be confirmed through the console source/stack or an extension-free private/guest browser session.

This closes the authenticated comment query-shape boundary. Hard-delete denial, ownership/former-owner boundaries, revocation, offline/local isolation, and remaining Phase H release checks are still pending.

## Safety boundary

- Use a dedicated test workspace and a dedicated active test card for any positive direct API mutation.
- Do not use production content that is not explicitly designated for testing.
- Do not paste Firebase ID tokens, Google credentials, cookies, API keys, invite links, or screenshots containing sensitive values into chat, issues, commits, or logs.
- The direct REST probe prints statuses only and never prints response bodies or bearer tokens.
- Firestore hard deletion of cloud parents and comments is denied. Use soft removal or archive for cleanup.
- Local browser data must remain unchanged throughout every cloud test.

## Direct Firestore probe

`scripts/phase-h-direct-access.mjs` performs authenticated reads and intentional negative writes without using Firebase Admin credentials.

Required local-only target variables:

```text
FLOWBOARD_WORKSPACE_ID
FLOWBOARD_BOARD_ID
FLOWBOARD_CARD_ID
```

Authenticated-member mode also requires:

```text
FLOWBOARD_ACCESS_TOKEN
```

Optional:

```text
FLOWBOARD_PROJECT_ID
FLOWBOARD_TAMPER_WORKSPACE_ID
FLOWBOARD_ANONYMOUS
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
- comment collection read with `pageSize=26`: HTTP 403;
- comment collection read without `pageSize`: HTTP 403;
- cross-workspace workspace read: HTTP 403;
- stale direct card write: HTTP 403;
- malformed direct comment write: HTTP 403.

For an anonymous production check, set `FLOWBOARD_ANONYMOUS=YES` and omit `FLOWBOARD_ACCESS_TOKEN`. Workspace, board, card, and bounded-comment reads must then also return HTTP 403. Output redacts all target identifiers in both modes.

Run the authenticated probe with a member token only when the token can remain local and ephemeral. The browser-session SDK checks already establish owner/editor/viewer/non-member role boundaries without token handling. A token must never be considered evidence of identity unless its Firebase Auth account is independently verified in the test record.

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

When selecting a cross-author target after creating and soft-removing a test comment, do not select by `deletedAt` alone while a server timestamp may still be resolving. Resolve the current session and require both a different `authorUid` and `deletedAt == null`. A `COMMENT_UNAVAILABLE` client precondition is not production Rules denial evidence.

Cross-workspace and malformed-ID probes use a different known workspace ID and deliberately forged board/card IDs. Do not use an administrator console write as evidence because administrator access bypasses Security Rules.

The browser SDK path includes a read-only `probeCommentQueryAuthorization` diagnostic for the query-shape gate. It returns classifications only and never returns comment documents:

```js
await FlowboardRuntime.cloudAdapter.probeCommentQueryAuthorization(H)
```

Expected authenticated member result:

```text
bounded: allowed
overLimit: permission-denied
unbounded: permission-denied
```

This proves the production Rules distinguish an explicit limit of 25 from a limit of 26 and a missing limit without copying a bearer token.

The local-only REST probe remains available for independent raw HTTP status checks. Never place its bearer token in chat, files, shell history, or logs.

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
