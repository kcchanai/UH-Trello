# Phase H release, privacy, and direct authorization validation

## Status

Phase H is complete. Production authorization, privacy, revocation, stale-conflict, convergence, accessibility, quota, deployment, and archive-only cleanup evidence passed on 2026-08-02. G5 notifications remains deferred.

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

### Ownership transfer and former-owner boundary - PASS - 2026-08-02

Tested against the dedicated Phase H workspace using the established owner and editor accounts.

Recorded result:

- ownership transferred from the original owner to the existing editor through the production application;
- the successor account obtained owner access;
- the former owner retained editor membership but a direct invitation-list read was denied with `permission-denied`;
- the former owner's direct invitation-create attempt was denied with `permission-denied`;
- probe sentinel: `FORMER OWNER DIRECT PASS`;
- the temporary owner transferred ownership back to the original owner;
- the original owner was restored to owner and the temporary owner was restored to editor;
- restoration sentinel: `OWNERSHIP RESTORED PASS`;
- the cloud test workspace and browser-local workspaces remained intact;
- no account identity, email, UID, invitation value, workspace ID, response body, or full error object was retained.

This establishes the production ownership-transfer invariant and removal of owner-only access from a former owner. Hard-delete denial, revocation, offline/local isolation, and remaining Phase H release checks are still pending.

### Hard-delete denial - PASS - 2026-08-02

Tested from the restored owner session through the deployed `probeHardDeleteAuthorization` diagnostic. The diagnostic generated cryptographically random nonexistent document IDs internally and accepted only the valid parent scope needed to reach nested Rules paths.

Recorded result:

- workspace hard delete: denied with `permission-denied`;
- board hard delete: denied with `permission-denied`;
- list hard delete: denied with `permission-denied`;
- card hard delete: denied with `permission-denied`;
- comment hard delete: denied with `permission-denied`;
- invitation hard delete: denied with `permission-denied`;
- activity hard delete: denied with `permission-denied`;
- probe sentinel: `HARD DELETE DENIAL 7/7 PASS`;
- no existing record was targeted or deleted;
- no account identity, UID, production child document ID, response body, or full error object was retained.

This closes the production hard-delete boundary. Revocation, offline/local isolation, and remaining Phase H release checks are still pending.

### Revocation/offline attempt 1 - PARTIAL PASS, CLIENT LIFECYCLE FIX REQUIRED - 2026-08-02

The editor opened the dedicated cloud test card, preserved a browser-local workspace fingerprint, took only that browser offline, and queued a real comment `writeBatch`. The owner then removed the editor while the editor remained offline. On reconnect:

- queued offline write rejection: PASS with `permission-denied`;
- direct post-revocation workspace read denial: PASS with `permission-denied`;
- direct post-revocation comment write denial: PASS with `permission-denied`;
- browser-local workspace isolation: PASS, unchanged;
- automatic listener shutdown and return to local mode: FAIL;
- reported sentinel: `REVOCATION OFFLINE FAIL Revocation checks failed: listenerShutdown`.

This proves deployed Rules enforced revocation for queued and direct operations, but the application remained in cached cloud mode because it depended only on listener error delivery after reconnect. Phase H remains blocked on this client lifecycle failure.

Corrective control: the cloud adapter now exposes a server-backed `verifyWorkspaceAccess` membership read, and the sync controller performs that preflight on the browser `online` event before restarting listeners. A missing or denied membership triggers the existing access-removal path, stops subscriptions, reloads browser-local state, and clears cloud mode. A regression test reproduces removal while offline and requires access removal on reconnect.

Production retest was required after deployment. No editor membership was restored until the corrected client was deployed.

### Revocation/offline production retest - PASS - 2026-08-02

After commit `3d2e069` passed CI and deployed, the editor was restored, opened the corrected release, preserved a fresh local-state fingerprint, and went offline. The owner removed the editor while that browser remained offline. On reconnect without refresh:

- server-backed membership preflight detected removed access;
- realtime subscriptions stopped;
- application automatically returned to local mode;
- browser-local workspace state remained unchanged;
- retest sentinel: `LISTENER RETEST 2/2 PASS`.

The owner then issued a fresh invitation and restored the account as editor. Final verification established:

- cloud mode reopened successfully;
- restored role was editor;
- the originally rejected queued comment was absent from production;
- restoration sentinel: `EDITOR FINAL RESTORE 3/3 PASS`;
- no account identity, email, UID, invitation value, production document ID, comment body, response body, or full error object was retained.

Combined with attempt 1, this establishes queued offline write rejection, post-revocation direct read/write denial, listener shutdown on reconnect, automatic return to unchanged local data, and safe editor restoration. The Phase H direct authorization and revocation/offline groups are complete.

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

The browser SDK also includes `probeHardDeleteAuthorization`. It generates cryptographically random nonexistent document IDs internally and attempts deletion at the workspace, board, list, card, comment, invitation, and activity paths. It never accepts a real child document ID and returns authorization classifications only. Every classification must be `permission-denied`. Because all targets are nonexistent, an unexpectedly allowed operation cannot delete production data.

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

## Conflict and two-browser convergence evidence - PASS - 2026-08-02

Same-card stale-revision production test:

```text
OWNER CONFLICT PREP PASS
EDITOR CONFLICT PREP PASS
OWNER CONFLICT WINNER PASS
EDITOR STALE CONFLICT PASS
CONFLICT RESTORE PASS
```

The owner committed revision N+1. The editor then submitted the prepared revision N against the same card and received the client classification `REVISION_CONFLICT`. A server-backed fetch confirmed the stale value did not overwrite the owner's accepted value or revision. The owner restored the dedicated fixture through revision N+2.

Different-card production test through the supported card UI:

```text
SECOND CONVERGENCE FIXTURE PASS
EDITOR TWO-FIXTURE LISTENER PASS
OWNER UI EDIT PASS
EDITOR UI EDIT PASS
TWO-BROWSER CONVERGENCE PASS
CONVERGENCE RESTORE PASS
CONVERGENCE CLEANUP PASS
EDITOR CLEANUP LISTENER PASS
```

Two fresh cards were created through the supported UI. Their creation converged to the editor listener without refresh. The owner and editor then edited different cards through **Save changes**. Both browsers displayed both accepted titles without refresh and reported `Synced`. Both fixture titles were restored, the owner archived both temporary cards rather than attempting prohibited hard deletion, and the editor listener removed both from the active board without refresh.

Failed direct-probe attempts are retained separately and are not relabelled as passes:

```text
OWNER DIFFERENT-CARD EDIT FAIL permission-denied
```

The failed direct operation expected an allow, so `permission-denied` is a failed probe result. It targeted an automatically selected older migrated card whose raw rehydrated record lacked an integer revision. Subsequent fixture-selection attempts made no writes. The supported UI acceptance used two new dedicated fixtures and passed; it does not claim that the failed low-level operation was rerun against the same card or payload.

No credential, email, UID, opaque document identifier, card content beyond fixed Phase H sentinel titles, full error object, or listener payload was retained.

### Concurrent card-move attempt 1 - FAIL, CLIENT FIX REQUIRED - 2026-08-02

Two restored disposable cards were opened in separate owner and editor sessions. The editor move succeeded, but the owner move did not converge. A focused dispatch through the same supported `Alt+ArrowRight` UI handler exposed the client error:

```text
OWNER KEYBOARD EVENT MOVE FAIL
Firestore transactions require all reads to be executed before all writes.
```

The failed move did not change or duplicate the owner fixture. Inspection found that `applyCloudWorkspaceMutation` read each changed document and then immediately wrote it before reading the next changed document. A move that affected multiple card records therefore violated the Firestore transaction requirement that every read precede the first write.

The client fix prepares all affected references, reads every current snapshot with `Promise.all`, validates all revisions, and only then applies writes. Static validation now rejects any `transaction.get()` in the workspace-mutation write phase.

Corrected release `2fe0cb0` passed local application, static, production-build, performance, and diff checks. GitHub validation run `30800083052` then passed the Java-backed 21-test Firestore Rules suite, all seven browser checks, and automated accessibility. Pages deployment run `30800082527` succeeded, and the cache-busted live release opened with zero console errors.

The same owner moved `Phase H convergence fixture` from list index 0 to list index 1 through the supported keyboard handler. The editor received the accepted move without refresh. Both sessions agreed on card-to-list placement, each fixture appeared exactly once, and no card was lost or duplicated:

```text
OWNER CARD MOVE FIX RETEST PASS
EDITOR MOVE FIX LISTENER PASS
TWO-BROWSER MOVE CONVERGENCE PASS
NO DUPLICATE CARDS PASS
```

The owner then archived both disposable fixtures through the supported in-app lifecycle. The editor listener removed both from the active board without refresh, and no hard delete was attempted:

```text
MOVE FIXTURE CLEANUP PASS
EDITOR MOVE CLEANUP LISTENER PASS
NO ACTIVE MOVE FIXTURES PASS
```

## Sign-out lifecycle evidence - PASS - 2026-08-02

The editor kept a cloud card open and preserved a serialized browser-local workspace fingerprint before invoking the same adapter sign-out transition used by the account UI.

Initial result:

```text
SIGNOUT PREP PASS
SIGNOUT LIFECYCLE FAIL Sign-out checks failed: localStatus
```

Five substantive checks passed in that attempt: the Firebase session became null, cloud listeners were stopped through the auth-state callback, the application returned to local mode, the open cloud dialog closed, and the serialized local workspace was unchanged. The only failure was an incorrect probe expectation. The probe expected the transient authentication text `Google sign-in available`, but the application local-mode render intentionally replaces it with `Cloud setup detected`.

Corrected status-only retest:

```text
SIGNOUT STATUS RETEST 2/2 PASS
```

The retest confirmed local mode and the intended final local status. The initial partial failure remains in this record and is not rewritten as a full first-attempt pass.

Final restoration:

```text
EDITOR SIGNIN RESTORE 4/4 PASS
```

The editor signed back in, reopened the supported cloud workspace, returned to cloud mode with the `editor` role, and retained the same serialized browser-local workspace fingerprint.

## Offline, conflict, and local isolation

- [x] Use two browser sessions on different cards and verify convergence.
- [x] Edit the same card from both sessions with a stale revision. Confirm conflict handling and no silent overwrite.
- [x] Disconnect one browser before a mutation. Confirm the UI does not claim `Synced` for an uncommitted write.
- [x] Reconnect and verify either authoritative convergence or an explicit rollback/conflict outcome.
- [x] Sign out while a cloud card is open. Confirm listeners stop and local data remains available.
- [x] No persistent Firestore disk cache or persistent offline mutation queue is permitted in this release. A transient memory-only SDK batch may wait for reconnect, must not be reported as synced, and remains subject to server Rules when sent.

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

## Manual accessibility evidence - PASS - 2026-08-02

Aaron completed the cache-busted production inspection and reported:

```text
FINAL ACCESSIBILITY MANUAL PASS
```

The manual pass covered 200% browser zoom, 320 px responsive presentation, intentional board-lane horizontal scrolling, reachable header and dialog controls, visible pointer-accessible dialog closure, keyboard focus, forced colors, and reduced motion. It supplements the committed browser checks at 1280, 700, 440, and 320 px and does not replace automated Lighthouse or keyboard checks.

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
