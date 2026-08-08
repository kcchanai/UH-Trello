# Flowboard production hardening and beta-readiness plan

Last reevaluated: 2026-08-07 HST

This is the authoritative sequential plan for Flowboard. It replaces the earlier implementation handoff for Phases E through H, which are now deployed. Historical architecture and release evidence remain in `COLLABORATION_ARCHITECTURE.md`, `FIREBASE_COLLABORATION_PLAN.md`, and `PHASE_H_RELEASE_VALIDATION.md`.

## 1. Executive recommendation

Freeze new product features until the remaining workspace-lifecycle production gates are complete.

The core product is already deployed and broadly validated. The highest-value work is now security acceptance, independent-session convergence, evidence consolidation, and beta-risk control. Adding features before these gates close would increase test scope while the source budget has only 21 bytes of headroom.

Recommended order:

1. consolidate current documentation and acceptance tooling;
2. complete owner lifecycle tests in independent authenticated browser contexts;
3. complete editor, viewer, non-member, former-member, and revoked-member lifecycle authorization tests;
4. close production acceptance and leave the disposable fixture in an approved retained state;
5. make an explicit beta/no-beta decision, including institutional-data boundaries;
6. recover maintainability and source-budget headroom before any new feature release;
7. run a small, reversible beta before broader use.

## 2. Current production baseline

Last behavior-changing lifecycle client release:

```text
0b97993b43093e6cb0ccdda1a706d3e2f8d2b391
Restore cloud workspace open control
```

Current architecture:

- GitHub Pages and Vite static hosting;
- Firebase Google Authentication;
- Cloud Firestore Standard edition on Spark/no-cost;
- deny-by-default Firestore Security Rules;
- memory-only Firestore state with persistent disk caching disabled;
- explicit local/cloud switching with no silent upload, merge, replacement, synchronization, or deletion of browser-local data;
- granular, revision-aware cloud boards, lists, cards, activity, assignments, and comments;
- owner/editor/viewer roles, invitations, member administration, ownership transfer, revocation, and realtime convergence;
- owner-only rename, recoverable archive, and Restore with retained descendants;
- denied parent hard deletion and no claim of permanent erasure.

Current repository validation for this checkpoint:

```text
Application tests:       20/20 passed
Firestore Rules tests:   23/23 passed
Browser tests:            9/9 passed
Syntax/static checks:     passed
Automated accessibility: passed
Production build:         passed
Source budget:            209,979 / 210,000 bytes
```

The production Rules recovery revision was published separately from the Pages client. The two later lifecycle UI repairs did not change `firestore.rules`.

## 3. Current production acceptance matrix

| Gate | Status | Evidence boundary |
| --- | --- | --- |
| Owner create and rename | Passed | Disposable lifecycle fixture only |
| Interrupted granular migration recovery | Passed | Owner-readable, viewer-denied, revision-safe retry |
| Owner archive disclosure and retained status | Passed | Recoverable archive, no hard-delete claim |
| Automatic local fallback after active archive | Passed | Local board visibly restored |
| Owner Restore and restored Open control | Passed | Active row exposes Open, Rename, Archive |
| Retained cloud boards, lists, and cards | Passed | Restored fixture reopened without edits |
| Visual local baseline after Restore | Passed | `Website Launch` and recorded cards returned |
| Exact local-storage isolation | Passed | `flowboard-workspace` remained exactly 8,539 bytes; `flowboard-data` remained absent |
| Owner stale lifecycle conflict | Production pending | Built-dialog regression proves exact message and no stale rename; independent authenticated evidence remains required |
| Two-context rename convergence | Pending | Must converge without refresh |
| Two-context archive/listener shutdown | Pending | Must fail closed, stop listeners, return local, and avoid reconnect loops |
| Editor lifecycle denial | Pending | UI absence plus direct production denial |
| Viewer lifecycle denial | Pending | UI absence plus direct production denial |
| Non-member lifecycle denial | Pending | Direct production denial without data disclosure |
| Former/revoked-member lifecycle denial | Pending | Direct denial and listener shutdown |
| Final fixture disposition | Pending | Leave only the disposable fixture in an approved retained state |

## 4. Non-negotiable boundaries

- Modify production lifecycle state only for `Lifecycle acceptance renamed`.
- Never rename, archive, restore, migrate, or edit `My Flowboard workspace` for acceptance.
- Never ask for or retain passwords, authorization codes, tokens, cookies, emails, UIDs, opaque production IDs, invitation links, Firebase configuration values, or verbose logs.
- Firestore Rules, not UI control visibility, are the authorization boundary.
- Keep `flowboard-workspace` and `flowboard-data` independent from cloud lifecycle operations.
- Keep persistent Firestore disk caching disabled unless a separate privacy and revocation design is approved.
- Keep parent hard deletion denied. Archive remains retained and recoverable, not erasure.
- Do not use Firebase Console administrator writes as Rules evidence.
- Do not publish temporary open Rules.
- Do not add Cloud Functions, Firebase Hosting, paid email delivery, or billing-dependent features without a separate architecture and cost approval.
- Public Flowboard copy must not use em dashes.

## 5. Sequential execution plan

### Phase 0 - current-state consolidation

Goal: make the repository describe the deployed product and preserve repeatable acceptance tooling.

Work:

1. Replace stale implementation roadmaps and README claims with the current deployed baseline.
2. Record completed lifecycle production evidence in `VALIDATION_CHECKLIST.md`.
3. Retain a paste-safe localStorage equality probe that prints only key presence, byte counts, and PASS/FAIL.
4. Test probe capture, exact PASS, changed-value FAIL, and non-local blocking.
5. Run syntax/static, source-budget, build, and diff checks.
6. Commit only documentation, acceptance support, package test registration, and test-only changes after review. A documentation/tooling push must still pass CI; it does not require Firestore Rules publication when Rules are unchanged.

Exit gate:

- documents agree on deployed capabilities and remaining work;
- acceptance probe tests pass;
- no application or Rules behavior changes are hidden in the checkpoint;
- repository changes are reviewed before commit/push.

### Phase 1 - independent-context owner lifecycle

Goal: prove lifecycle convergence, stale-revision rejection, and listener shutdown outside a single browser context.

Use two independent authenticated browser contexts, preferably normal Chrome plus Chrome Incognito or Edge. Two ordinary tabs in one profile are weaker evidence because they share origin storage and authentication persistence.

Use the same owner account, but let the operator complete sign-in in each context. Never transfer session storage, cookies, or tokens.

#### 1A. Rename convergence and stale conflict

1. Open only `Lifecycle acceptance renamed` in both contexts.
2. Load the workspace picker in context B and leave its lifecycle revision stale.
3. Rename the fixture in context A to a temporary acceptance name.
4. Require context B's active workspace heading to converge without refresh.
5. Attempt a second rename from context B using its stale row.
6. Require the UI message:

   ```text
   This workspace changed in another session. Refresh and try again.
   ```

7. Require adapter classification `REVISION_CONFLICT` and prove no stale write occurred.
8. Refresh discovery deliberately, then rename the fixture back to `Lifecycle acceptance renamed`.
9. Require the canonical name to converge in both contexts.

#### 1B. Archive propagation and listener shutdown

1. Capture a local-storage fingerprint independently in context B while it is in local mode.
2. Open the fixture in both contexts and confirm active listeners.
3. Archive the fixture from context A only.
4. Require context B, without refresh, to stop cloud listeners, close unsafe dialogs, leave cloud mode, and reload its independent local workspace.
5. Inspect the console for repeated permission errors or reconnect loops. One classified access-loss transition is acceptable; repeated retries are not.
6. Compare context B's local storage exactly with its baseline.
7. Verify the archived row is retained and non-openable.
8. Restore from context A, reopen in both contexts, and verify retained content once without editing.
9. Return both contexts to local mode.

Exit gate:

- rename converges in an independent context;
- stale lifecycle mutation returns `REVISION_CONFLICT` and writes nothing;
- archive causes one fail-closed transition with no reconnect loop;
- context B local data is byte-for-byte unchanged;
- Restore exposes the original retained descendants;
- canonical fixture name is restored.

### Phase 2 - production role authorization matrix

Goal: verify lifecycle authorization with real production identities, not just hidden controls or Emulator tests.

Use existing test identities or create only the minimum memberships needed through supported invitation flows. The operator enters account information locally; no identity details are posted in chat or committed.

Required groups:

- owner positive rename/archive/restore on the disposable fixture;
- editor direct rename/archive/restore denial with `permission-denied`;
- viewer direct rename/archive/restore denial with `permission-denied`;
- non-member discovery/read and lifecycle denial without metadata disclosure;
- former owner denial after ownership is safely restored to the intended owner;
- revoked member denial plus listener shutdown;
- archived-state denial for non-owner content and member/invitation mutations;
- continued hard-delete denial, using random nonexistent child IDs where a negative write probe is needed.

Rules for probes:

- use browser-session SDK adapters where possible;
- print only operation category, expected classification, and PASS/FAIL;
- never print response bodies or full error objects;
- run expected-denied writes only against the disposable fixture or random nonexistent IDs;
- stop immediately if any expected denial succeeds.

Exit gate:

- every real-account role produces the expected authorization result;
- no account credential or identifier is retained;
- UI behavior and direct Rules behavior agree;
- any removed/revoked session fails closed and restores local mode.

### Phase 3 - production acceptance closeout

Goal: leave production in a known state and produce one unambiguous acceptance report.

Work:

1. Restore the exact canonical fixture name if needed.
2. Verify `My Flowboard workspace` remained untouched throughout testing.
3. Recommend leaving `Lifecycle acceptance renamed` archived and retained after all positive tests, because hard deletion is intentionally unavailable. Obtain explicit approval for the final state before the last archive.
4. Re-run the complete local validation chain if repository files changed.
5. Verify `firestore.rules` is unchanged unless a real defect required a reviewed Rules revision.
6. Record the final client commit, Rules revision/hash, CI runs, Pages run, production console result, and sanitized acceptance matrix.
7. Commit and push intended documentation/tooling changes using the repository's correct GitHub account, then restore the machine-wide account used by other projects.

Exit gate:

- all lifecycle matrix rows are passed or explicitly deferred with rationale;
- final fixture state is approved and verified;
- protected production data is untouched;
- repository, CI, Pages, and documentation agree.

### Phase 4 - beta readiness decision

Goal: decide whether Flowboard should enter a limited beta and what data it may hold.

Required decisions:

1. Identify intended beta users and maximum workspace/member counts.
2. Decide whether only personal/non-regulated data is allowed. No UH, FERPA, employment, health, financial, export-controlled, or confidential data is allowed without separate written institutional approval.
3. Confirm project/account succession if the `hawaii.edu` account changes or becomes unavailable.
4. Define support ownership, incident response, export/recovery guidance, and a user-visible retention/deletion explanation.
5. Recheck current Firebase pricing, quotas, terms, Authentication limits, and organization policy immediately before beta.
6. Define quota warning and stop conditions. Spark quota exhaustion must fail visibly, not lose writes silently.
7. Perform a manual assistive-technology pass with the beta user's actual browser and screen reader where relevant.

Exit gate:

- beta scope, prohibited data, support owner, quota thresholds, and account succession are written and approved;
- privacy and retention copy matches the implemented archive-only model;
- no claim of institutional approval is made without evidence.

### Phase 5 - engineering headroom before new features

Goal: restore maintainability and a defensible performance margin before adding product scope.

Current source usage is 209,979 of 210,000 bytes, leaving 21 bytes. This is not adequate development headroom.

Recommended work:

1. Freeze feature additions while the lifecycle acceptance phases run.
2. Produce an asset/module size report and identify dead, duplicated, or obsolete code.
3. Prefer removing dead paths and consolidating repeated logic over further hand-minifying maintainable source.
4. Preserve semantic static guards and behavioral browser tests while refactoring.
5. Target at least 10,000 bytes of source-budget headroom, or formally revise the budget only after documenting deployed transfer size, compression, parse cost, and target-device performance. Never raise the budget merely to silence a failing check.
6. Update stale package metadata and release notes.
7. Run the full unit, Rules, browser, accessibility, build, diff, and deployed-console gates after any source refactor.

Exit gate:

- the source budget has a meaningful documented margin;
- source remains reviewable;
- no local/cloud boundary, authorization, or accessibility regression occurs.

### Phase 6 - limited reversible beta

Goal: observe real usage without broad exposure or irreversible architecture commitments.

Recommended beta:

- a very small invited group;
- personal/non-regulated data only;
- explicit export guidance;
- regular quota review;
- no presence heartbeats, push notifications, paid email fan-out, or persistent cloud cache;
- a defined stop/rollback path if authorization, quota, account-lifecycle, or data-loss concerns appear.

Collect only privacy-minimal feedback and operational counts. Do not collect workspace contents for telemetry.

Exit gate:

- beta users complete local-only and shared workflows safely;
- quota use is sustainable;
- no unresolved authorization or data-isolation defect exists;
- expansion is explicitly approved rather than automatic.

## 6. Explicitly deferred architecture

The following are not approved by this plan:

- permanent recursive workspace erasure from the browser client;
- persistent Firestore disk caching;
- Cloud Functions or a custom backend;
- Firebase Hosting/App Hosting;
- paid email delivery or push fan-out;
- presence heartbeats;
- offline durable mutation queues;
- regulated or institutionally controlled data;
- broad public signup or uncontrolled beta access.

Permanent erasure requires a separately reviewed trusted backend or administrator process that can enumerate descendants, delete in resumable bounded batches, preserve authorization anchors until completion, verify final deletion, and honor retention policy.

## 7. Release discipline

For every committed milestone:

1. inspect repository status and the exact diff;
2. run focused tests for the change;
3. run `npm test`, `npm run check`, `npm run build`, and `git diff --check`;
4. run `npm run test:rules` whenever Rules or authorization assumptions change;
5. run the full browser/accessibility suite for client behavior changes;
6. commit only intended files;
7. push with the correct repository GitHub account;
8. verify validation and Pages workflow success;
9. load a cache-busted production URL and inspect the console;
10. restore the machine-wide GitHub account required by other projects.

A successful push is not deployment proof. A hidden control is not authorization proof. Emulator success is not production Rules proof.

## 8. Definition of complete

Flowboard lifecycle production acceptance is complete only when:

- all required role and independent-context checks pass;
- stale writes are rejected without state change;
- archive listener shutdown is prompt and loop-free;
- local storage remains byte-for-byte unchanged;
- retained data returns after Restore;
- the protected workspace is untouched;
- final fixture state is approved;
- documentation matches production behavior;
- CI, Pages, and the cache-busted production console pass.

New feature development should begin only after this definition is met and Phase 5 restores practical source-budget headroom.
