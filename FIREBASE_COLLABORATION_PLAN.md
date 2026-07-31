# Flowboard Firebase collaboration roadmap

This roadmap supersedes the Supabase-specific backend sections of `AUTH_COLLABORATION_IMPLEMENTATION_PLAN.md`. Phase A remains complete. The new target is GitHub Pages plus Firebase Authentication and Cloud Firestore on the no-cost Spark plan.

**Current handoff:** Phases A–C are complete. Phase D's backup-first cloud-copy creation and production read-back verification are complete; its original second-browser retrieval criterion is assigned to the Phase E workspace picker. Use `TERRA_NEXT_PHASES_PLAN.md` as the authoritative implementation sequence for Phase E0 onward.

## Non-negotiable product rules

- Local-only Flowboard remains usable without an account.
- Signing in never uploads, replaces, or hides local data.
- Membership belongs to a workspace, not an individual board.
- Roles are `owner`, `editor`, and `viewer` and are enforced by Firestore Security Rules.
- The browser never receives Admin SDK credentials, service-account keys, OAuth client secrets, or other privileged credentials.
- Cloud functionality is not claimed until tested against Firebase and the deployed GitHub Pages client.
- The first invitation release uses a copyable random link matched to the invitee's verified Google email. No paid function or email service is required.

## Target collections

```text
users/{uid}
workspaces/{workspaceId}
workspaces/{workspaceId}/members/{uid}
workspaces/{workspaceId}/invites/{inviteId}
workspaces/{workspaceId}/boards/{boardId}
workspaces/{workspaceId}/boards/{boardId}/lists/{listId}
workspaces/{workspaceId}/boards/{boardId}/cards/{cardId}
workspaces/{workspaceId}/activity/{activityId}
```

Documents use stable IDs, server timestamps, revision numbers or sortable ranks where ordering matters, and explicit schema versions. Assignees become member UIDs while legacy free-text names remain safely displayable until mapped.

## Phase A — adapter and build foundation (complete)

- Local persistence is behind `LocalWorkspaceAdapter`.
- Vite builds the GitHub Pages artifact for `/UH-Trello/`.
- Missing cloud configuration is reported honestly.
- Local workflows and deployment validation pass.

## Phase B — Firebase foundation and rules (complete)

1. Add pinned modular Firebase Web SDK dependencies and public configuration detection.
2. Add `firebase.json`, Firestore indexes, deny-by-default Security Rules, and Emulator Suite tests.
3. Test anonymous denial, workspace isolation, owner/editor/viewer behavior, invite acceptance constraints, revocation, and forged IDs independently of the UI.
4. Add GitHub Actions rule tests using a disposable `demo-*` Firebase project ID; never point automated tests at production.
5. Deploy rules/indexes only after Aaron creates the production Firebase project and grants an approved deployment path.

**Exit:** emulator tests and production rule deployment both pass; direct client requests cannot bypass roles.

## Phase C — Google authentication (complete)

1. Implement Google popup sign-in, session restoration, sign-out, popup/error states, and account identity.
2. Distinguish the local workspace from owned/shared cloud workspaces.
3. Preserve local state across sign-in and sign-out.
4. Test authorized domains and session reload locally and on GitHub Pages.

**Exit:** Google sign-in works in production without migrating local data.

## Phase D — cloud workspaces and migration (cloud-copy milestone complete)

1. Owners create an empty cloud workspace in an atomic batch with their owner membership.
2. Implement Firebase adapter reads/writes for boards, lists, cards, and activity.
3. Add explicit local-upload preview and idempotent migration batches.
4. Verify remote counts before considering migration successful; retain the local copy and export.
5. Add cloud-to-Flowboard JSON export.

**Exit status:** backup-first upload, owner membership, production rule enforcement, direct read-back verification, and local recovery preservation passed. Second-browser workspace discovery/retrieval is the first acceptance gate in `TERRA_NEXT_PHASES_PLAN.md` Phase E1.

## Phase E — invitations and members

Implementation detail and prerequisite rule hardening are defined in `TERRA_NEXT_PHASES_PLAN.md` Phases E0–E2. Follow that sequence rather than beginning with invitation UI.

1. Add owner-only member management.
2. Generate cryptographically random, expiring invite IDs and copyable links.
3. Permit acceptance only when the signed-in verified email, role, workspace, expiry, and active status match the invitation.
4. Add revocation, role changes, removal, leave, and atomic ownership transfer/last-owner protection.
5. Replace new free-text assignees with accepted workspace members.

**Exit:** owner, editor, viewer, invitee, revoked user, and non-member rule tests pass, including direct API attempts.

## Phase F — realtime and offline convergence

1. Subscribe only to the active workspace/board with Firestore snapshot listeners.
2. Show pending writes, synced, offline, retrying, and conflict states truthfully.
3. Use transactions/batches and sortable ranks for concurrent structural changes.
4. Reconcile local pending mutations, revision gaps, role changes, and revocation.
5. Unsubscribe and clear inaccessible cloud data immediately after access loss.

**Exit:** two browsers converge after create/edit/move/archive operations without duplicate mutations.

## Phase G — collaboration features

- Authenticated actor activity
- Member-backed assignments
- Comments and safe mentions
- Quota-conscious notifications
- Presence only if it can avoid wasteful Firestore heartbeat reads/writes
- Rate limits expressible safely without paid Cloud Functions; defer features that require trusted server fan-out

## Phase H — production release

- Owner/editor/viewer end-to-end tests
- Direct-rule negative tests and cross-workspace isolation
- Offline/reconnect/conflict/revocation tests
- Accessibility, narrow-screen, reduced-motion, forced-colors, Lighthouse, and performance validation
- Quota monitoring and read-efficient listener audit
- Export, deletion, privacy, retention, and redacted-error documentation
- Deployed GitHub Pages two-account smoke test

## Spark-plan constraints

- Keep GitHub Pages; do not enable Firebase App Hosting.
- Do not use phone authentication, paid email delivery, or Cloud Functions in the initial release.
- Use the Emulator Suite for automated tests.
- Subscribe only to active data and batch writes where appropriate.
- Surface quota errors and preserve local exports.
- Review current Firebase pricing before beta because limits can change.
