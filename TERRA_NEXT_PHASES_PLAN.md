# Flowboard next phases — Terra implementation plan

This is the implementation handoff for continuing Flowboard after the production Google Authentication and verified backup-first cloud-copy milestones. It is intentionally sequential: preserve the live local-first product, ship one independently testable milestone at a time, and do not call a phase complete until its negative security tests pass.

## 1. Current production baseline

As of commit `f32f321`:

- GitHub Pages remains the only web host.
- Firebase Google Authentication works on the production domain.
- Cloud Firestore exists with version-controlled, deny-by-default Security Rules.
- The authenticated owner can explicitly download a local JSON backup, create a separate cloud workspace, upload boards, and verify the remote documents.
- The browser-local original remains active after migration.
- Firebase Authentication loads at startup; the larger Firestore workspace module is lazy-loaded.
- CI runs application tests, Firestore Emulator rules tests, browser workflows, Lighthouse accessibility, and the Vite Pages build.
- Spark/no-billing architecture remains the initial constraint; pricing and quotas must be rechecked before beta.

The current cloud copy is **not yet an editable shared workspace**. There is no cloud workspace picker, invitation UI, member administration, realtime editing, comments, or release-grade multi-account validation.

### Known documentation and acceptance gaps

1. `COLLABORATION_ARCHITECTURE.md` still describes the superseded Supabase recommendation. Update it before implementing new Firebase collaboration behavior.
2. The cloud-copy write/read-back was production-tested in one authenticated browser. Add second-browser retrieval through the workspace picker before considering Phase D's original cross-device exit criterion fully closed.
3. Existing cloud board documents contain a whole-board `snapshot`. Do not build concurrent editing directly on that representation; first migrate to granular board/list/card documents.
4. `users/{uid}.workspaceIds` can contain stale IDs after another user removes that member because owners cannot safely write another user's profile. Workspace discovery must tolerate denied/missing references and let the signed-in user prune their own stale references.

## 2. Non-negotiable constraints

- Local-only mode remains permanent and fully usable without an account.
- Signing in never uploads, switches, merges, or deletes local data.
- Switching from local to cloud must be explicit and reversible by switching back.
- Authentication is not authorization. Firestore Security Rules remain the source of truth.
- Workspace membership—not board metadata—defines access.
- Roles remain `owner`, `editor`, and `viewer`.
- Never expose or request service-account JSON, Admin SDK credentials, OAuth client secrets, private keys, passwords, or Firebase CI tokens.
- Keep GitHub Pages; do not introduce Firebase Hosting, Cloud Functions, phone authentication, or paid email delivery.
- Invitation links alone never grant access. Acceptance requires a verified Google email matching the active invitation.
- Never deploy Test mode or temporary open Firestore rules.
- Cloud data must never be represented as synchronized until actual Firestore listeners and mutation handling are active.
- Avoid persistent Firestore disk caching until revocation/privacy behavior is explicitly designed and tested. Memory-only cloud state is safer for the first shared release.
- Destructive actions use accessible in-app confirmation, restore focus, and explain consequences.
- Every pushed milestone must leave `main` deployable and local mode intact.

## 3. Target Firestore model

Use this model for the shared-editing implementation:

```text
users/{uid}

workspaces/{workspaceId}
workspaces/{workspaceId}/members/{uid}
workspaces/{workspaceId}/invites/{inviteId}
workspaces/{workspaceId}/boards/{boardId}
workspaces/{workspaceId}/boards/{boardId}/lists/{listId}
workspaces/{workspaceId}/boards/{boardId}/cards/{cardId}
workspaces/{workspaceId}/activity/{eventId}
```

Cards are siblings of lists under a board and carry `listId` plus `rank`. This makes cross-list movement an atomic card update rather than delete/create across list subcollections.

### Required common fields

- Workspace: `name`, `ownerUid`, `schemaVersion`, `status`, `activeBoardId`, `createdAt`, `updatedAt`.
- Membership: `uid`, `emailLower`, `displayName`, `role`, `joinedAt`, optional `invitedBy`/`inviteId`.
- Invitation: `emailLower`, `role`, `createdBy`, `createdAt`, `expiresAt`, `revokedAt`, `acceptedAt`, `acceptedBy`.
- Board/list/card: stable ID, sortable `rank`, integer `revision`, `createdAt`, `updatedAt`, and entity-specific fields.
- Activity: immutable `actorUid`, `action`, target identifiers, redacted summary, and server timestamp.

New assignments use member UIDs. Legacy free-text assignee names remain readable until explicitly mapped.

## 4. Implementation sequence

## Phase E0 — reconcile architecture and harden rules

### Work

1. Rewrite `COLLABORATION_ARCHITECTURE.md` as the Firebase decision record and remove active Supabase instructions.
2. Update `FIREBASE_COLLABORATION_PLAN.md`, `README.md`, and `VALIDATION_CHECKLIST.md` to reflect completed Auth/cloud-copy work and this sequence.
3. Review `firestore.rules` against the granular board/list/card paths.
4. Add explicit rule helpers for:
   - authenticated/verified email checks;
   - owner/editor/viewer access;
   - immutable membership UID and protected owner membership;
   - non-owner self-leave;
   - invitation creation limited to editor/viewer and no more than seven days;
   - single-use acceptance by matching verified email;
   - revoked/expired/accepted invitation denial;
   - dedicated atomic ownership transfer.
5. Design ownership transfer as one batch/transaction that updates `workspace.ownerUid`, demotes the old owner's membership, and promotes an existing accepted member. Ordinary role editing must never mint an owner.
6. Add rules tests before adding corresponding UI.

### Mandatory rules tests

- Anonymous denial and cross-workspace isolation.
- Owner/editor/viewer positive and negative access.
- Member cannot promote self or another member to owner.
- Owner cannot delete/demote protected owner through ordinary member operations.
- Non-owner member can leave; owner cannot leave without transfer.
- Invite creation rejects owner role, unverified/invalid recipient shape, and expiry beyond seven days.
- Wrong email, unverified email, expired, revoked, accepted, or role-tampered acceptance fails.
- Accepted invitation cannot be reused.
- Ownership transfer succeeds only as the complete atomic operation and never leaves zero owners.
- Forged workspace/member/invite IDs fail through direct Firestore calls.

### Exit gate

Emulator tests pass in CI; reviewed rules are deployed to production; production owner/editor/viewer/non-member direct-access checks pass before member UI is enabled.

## Phase E1 — cloud workspace discovery and switching shell

### Work

1. Add a workspace selector that clearly separates:
   - `Local workspace`;
   - owned cloud workspaces;
   - shared cloud workspaces.
2. Make `listWorkspaces()` resilient:
   - use settled reads rather than failing the whole list for one denied/missing workspace;
   - ignore inaccessible references;
   - allow the signed-in user to prune stale IDs from their own `users/{uid}` document.
3. Add cloud metadata/read-only retrieval for the existing migrated workspace.
4. Opening a cloud workspace must be explicit. Preserve local state in storage and retain a visible **Return to local workspace** action.
5. Until granular migration and mutations ship, label cloud content **read-only cloud preview**.
6. Add cloud-to-Flowboard JSON export before enabling cloud editing.

### Acceptance

- Aaron can sign in on a second browser/device, see the created cloud workspace, open the read-only preview, and export equivalent data.
- Switching to the preview does not overwrite `flowboard-workspace`.
- Signing out or returning local restores the local board immediately.
- A stale/denied workspace reference does not break the selector.

### Exit gate

Second-browser count/content equivalence passes, completing the remaining Phase D cross-device retrieval criterion.

## Phase E2 — invitation and member administration

### Invitation creation

1. Owner enters a normalized recipient Google email and chooses editor/viewer.
2. Generate at least 128 bits of randomness using `crypto.getRandomValues`; encode as URL-safe text.
3. Store an invitation with a seven-day expiry and server timestamps.
4. Produce a copyable GitHub Pages URL containing workspace and invite IDs. IDs are identifiers, not authority.
5. Show pending, expired, revoked, and accepted states.

### Invitation acceptance

1. Preserve `workspace` and `invite` query parameters through Google sign-in.
2. Do not reveal recipient details before authenticated authorization succeeds.
3. In one batch:
   - create `members/{auth.uid}` from immutable invitation role/email;
   - mark invitation accepted by that UID;
   - add the workspace ID to the accepting user's own profile.
4. Display generic denial for wrong account, expired/revoked link, or reused invitation without leaking the intended email.

### Member administration

- Owner can list members, change editor/viewer roles, remove non-owner members, revoke pending invitations, and initiate ownership transfer.
- Editor/viewer can inspect membership and leave the workspace.
- Removed users may retain a stale self-profile reference; workspace discovery handles and optionally prunes it.
- UI controls reflect role for usability, while direct rules enforce every operation.
- New card assignment controls list accepted workspace members by UID.

### Exit gate

Use separate real Google accounts for owner, editor, and viewer. Confirm acceptance, wrong-account denial, role change, removal, self-leave, revocation, ownership transfer, and direct API denial. Do not proceed to realtime editing until revocation works independently of hidden UI.

## Phase F0 — migrate whole-board snapshots to granular documents

### Work

1. Add an idempotent owner-only migration command for each cloud workspace.
2. For every existing `boards/{boardId}.snapshot`:
   - create board metadata;
   - create ranked list documents;
   - create ranked card documents with `listId`;
   - preserve rich card fields, archive state, and legacy assignee display data;
   - record a migration version/status.
3. Verify entity counts and IDs through direct reads.
4. Keep the original snapshot until verification succeeds and a cloud JSON export is available.
5. Only after successful verification, mark granular data authoritative. Deleting legacy snapshots is a later explicit cleanup operation.
6. Test retry/idempotency after interruption; duplicate lists/cards must not be created.

### Exit gate

Migrated counts and exports match the original cloud copy in two browsers, with local and legacy cloud recovery still available.

## Phase F1 — active cloud adapter and role-aware editing

### Work

1. Refactor UI persistence orchestration so an active workspace has an explicit mode: `local` or `cloud`.
2. Subscribe only to:
   - active workspace metadata;
   - current user's membership;
   - active board metadata, lists, and cards.
3. Unsubscribe when switching board/workspace, signing out, leaving, being removed, or losing permission.
4. Enforce UI behavior:
   - owner/editor: board/list/card mutations;
   - viewer: read-only controls and direct-rule denial;
   - owner-only member/invite/workspace lifecycle actions.
5. Keep local adapter behavior unchanged and independently tested.

### Mutation design

- Use per-document integer `revision` and transaction preconditions for edits.
- Each client mutation has a cryptographically random `clientMutationId` for deduplication and activity correlation.
- Writes use server timestamps and atomic batches where multiple documents must move together.
- Card moves update `listId`, `rank`, revision, and activity atomically.
- Reorders use sparse/fractional ranks and periodic bounded rebalance batches.
- A revision conflict does not silently overwrite: fetch remote state and offer reload/reapply guidance.

### Exit gate

Owner/editor can create, edit, move, archive, and recover content; viewer is denied in UI and direct Firestore calls; local mode remains unaffected.

## Phase F2 — realtime, pending, offline, and revocation behavior

### Work

1. Use Firestore snapshot metadata to expose `Saving…`, `Synced`, `Offline`, `Retrying`, and `Access removed` truthfully.
2. Do not enable persistent Firestore disk caching in the first shared release. Start with memory-only listeners to reduce post-revocation residual cloud data.
3. If an explicit local pending-mutation queue is added:
   - store client mutation IDs and base revisions;
   - bound queue size/age;
   - replay idempotently;
   - stop and clear inaccessible queued cloud mutations after revocation;
   - never report queued writes as synced.
4. On permission denial or membership deletion:
   - unsubscribe immediately;
   - clear in-memory cloud state;
   - return to the workspace selector/local option;
   - explain that local data was not affected.
5. Surface quota/resource-exhausted errors and preserve export access where authorization permits.

### Two-browser test matrix

- Simultaneous edits to different cards converge.
- Same-card revision conflict is detected and not silently lost.
- Concurrent card moves converge without duplicate cards.
- Offline mutation visibly queues/retries and converges after reconnect.
- Viewer direct write fails.
- Member removal terminates reads/writes and listeners.
- Role downgrade takes effect without reload.
- Sign-out clears cloud UI while local workspace remains.

### Exit gate

Two browsers converge across the required operations, conflict/offline states are truthful, and revocation prevents subsequent direct reads/writes.

## Phase G — collaboration features

Implement only after the core shared board is secure and convergent:

1. Authenticated actor activity with bounded pagination.
2. Member-backed assignments and legacy-assignee mapping.
3. Comments with edit/delete ownership rules and safe text rendering.
4. Safe mentions without paid push/email fan-out.
5. Quota-conscious in-app notifications.
6. Presence only if a design avoids periodic heartbeat waste; otherwise defer it.

Each feature requires its own Security Rules tests, accessibility pass, quota estimate, and redacted error handling.

## Phase H — production release and privacy

### Security validation

- Real owner/editor/viewer/non-member accounts.
- Cross-workspace ID tampering and direct API attempts.
- Expired/revoked/reused invite tests.
- Ownership transfer and last-owner protection.
- Revocation during an active session and during queued/offline work.
- Rules deployment hash/version recorded in release notes.

### Product validation

- Local-only regression suite.
- Explicit local/cloud switching and exports.
- Two-browser realtime and conflict scenarios.
- Narrow widths (including 573 px and 320 px), 200% zoom, forced colors, reduced motion, keyboard-only operation, dialog focus return, and screen-reader labels.
- Lighthouse accessibility score 1 with no failed audits.
- Initial/auth bundle and lazy Firestore chunk budgets.
- Listener/read/write audit against current Spark quotas.

### Privacy and lifecycle

- Explain Firebase/Google account data, workspace membership visibility, retention, exports, and deletion.
- Add owner-confirmed workspace deletion with recent JSON export guidance.
- Add account/workspace leave behavior and member removal documentation.
- Redact emails, tokens, invite IDs, and document contents from user-facing diagnostics and logs.
- Decide whether institutional/UH-controlled data is permitted before beta.
- Recheck Firebase pricing, quotas, terms, and any hawaii.edu organization policies before release.

### Exit gate

Only call collaboration production-ready after all role, direct-access, cross-workspace, revocation, conflict, offline, export/deletion, accessibility, quota, and deployed two-account tests pass.

## 5. Commit and release strategy

Use small, independently deployable commits, for example:

1. `Update Firebase collaboration architecture and rule tests`
2. `Add cloud workspace picker and read-only preview`
3. `Add verified-email invitations and member administration`
4. `Migrate cloud boards to granular Firestore documents`
5. `Add role-aware cloud workspace editing`
6. `Add realtime sync and conflict handling`
7. `Add collaboration activity and comments`
8. `Complete collaboration security and release validation`

For every milestone:

1. Run unit, syntax/static, performance, build, and emulator rules tests.
2. Exercise positive and negative paths in a real browser.
3. Commit only intended files; push `main`.
4. Require both validation and Pages deployment workflows to pass.
5. Load a cache-busted production URL and inspect the console.
6. If a transient Lighthouse Chrome-launch failure occurs after browser tests pass, rerun the failed job rather than weakening the gate.

## 6. Terra execution instructions

Terra should begin with Phase E0, not invitation UI. Read the current rules, adapter contract, Firebase adapters, cloud-migration UI, state domain, and browser/rules tests before editing. Preserve the production Firebase project and public configuration; never request privileged credentials.

After E0, proceed sequentially without bundling all remaining phases into one change. Post a concise phase report after each verified deployment. Stop and ask Aaron only when a real human-controlled prerequisite is required, such as:

- publishing materially changed production Firestore Rules if no authenticated deployment path is available;
- testing with a separate real Google identity;
- deciding an irreversible privacy/data-residency policy;
- approving a feature that would require billing or a paid service.

No phase is complete based solely on client UI. Security and collaboration claims require emulator tests plus real deployed multi-account/direct-access verification.
