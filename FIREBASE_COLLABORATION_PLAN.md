# Flowboard Firebase collaboration roadmap

Last reconciled: 2026-08-07 HST

This document summarizes the delivered Firebase collaboration architecture. The active remaining-work sequence is [`TERRA_NEXT_PHASES_PLAN.md`](TERRA_NEXT_PHASES_PLAN.md).

## Current status

Phases A through H are implemented and deployed. Core production authorization, shared editing, revocation, conflict handling, accessibility, privacy, quota review, and deployment validation passed. The owner-only workspace lifecycle extension is deployed and has passed owner archive/restore, retained-content recovery, and exact local-storage isolation. Independent-context lifecycle convergence and the lifecycle-specific real-account denial matrix remain open.

Current deployed lifecycle client:

```text
0b97993b43093e6cb0ccdda1a706d3e2f8d2b391
Restore cloud workspace open control
```

## Non-negotiable product rules

- Local-only Flowboard remains usable without an account.
- Signing in never uploads, replaces, synchronizes, or hides local data.
- Membership belongs to a workspace, not an individual board.
- Roles are `owner`, `editor`, and `viewer` and are enforced by Firestore Security Rules.
- The browser never receives privileged credentials.
- Invitation links alone are not authority; acceptance requires the matching verified Google account.
- Cloud parent hard deletion remains denied.
- Workspace archive is retained and recoverable, not permanent erasure.
- Persistent Firestore disk caching remains disabled pending a separate privacy/revocation design.

## Deployed collection model

```text
users/{uid}
workspaces/{workspaceId}
workspaces/{workspaceId}/members/{uid}
workspaces/{workspaceId}/invites/{inviteId}
workspaces/{workspaceId}/boards/{boardId}
workspaces/{workspaceId}/boards/{boardId}/lists/{listId}
workspaces/{workspaceId}/boards/{boardId}/cards/{cardId}
workspaces/{workspaceId}/boards/{boardId}/cards/{cardId}/comments/{commentId}
workspaces/{workspaceId}/activity/{activityId}
```

Documents use stable IDs, server timestamps, bounded fields, revision numbers, mutation identifiers, and sortable ranks where ordering matters. New cloud assignees use member UIDs; legacy local free-text assignments remain readable.

## Delivered phases

### Phase A - adapter and build foundation: complete

- Local persistence is behind `LocalWorkspaceAdapter`.
- Vite builds the `/UH-Trello/` GitHub Pages artifact.
- Local data migration, recovery, import/export, and persistence boundaries are tested.

### Phase B - Firebase foundation and Rules: complete

- Modular Firebase Web SDK integration is deployed.
- Firestore Rules are deny-by-default and version-controlled.
- Emulator tests cover role boundaries, invitations, ownership, archived state, migrations, retained content, and hard-delete denial.
- Production Rules publication remains a separate human-controlled step from Pages deployment.

### Phase C - Google Authentication: complete

- Google popup sign-in, session restoration, sign-out, and visible account state are deployed.
- Authentication alone does not switch or migrate local data.

### Phase D - cloud workspace migration: complete

- Cloud-copy creation is explicit, count-previewed, backup-first, verified, and recoverable.
- Granular migration is owner-only, revision-aware, and retryable after interruption.
- Browser-local state remains independent.

### Phase E - workspace discovery, invitations, and members: complete

- Owned/shared workspace discovery and explicit switching are deployed.
- Verified-email invitations, revocation, role changes, member removal, self-leave, and atomic ownership transfer are deployed.
- Stale or denied workspace references do not grant access.

### Phase F - granular editing and realtime convergence: complete

- Active cloud workspaces use granular board/list/card documents.
- Owner/editor mutations use transactions, expected revisions, and mutation IDs.
- Viewer mode is read-only in the UI and denied by Rules.
- Memory-only listeners stop on mode change, sign-out, revocation, or access loss.
- Conflict, offline, pending, synchronized, and access-removed states remain distinct.

### Phase G - collaboration surfaces: complete with explicit deferrals

Delivered:

- privacy-minimal append-only activity;
- member-backed assignments;
- authenticated bounded comments with soft removal;
- accessible role-aware controls.

Deferred:

- presence heartbeats;
- paid or server-backed notifications;
- durable offline queues;
- persistent cloud disk caching.

### Phase H - production release and privacy: core complete

Passed evidence includes:

- owner/editor/viewer/non-member direct authorization;
- forged/cross-workspace denial;
- bounded comment query authorization;
- ownership transfer and former-owner boundaries;
- parent hard-delete denial;
- revocation during offline/reconnect;
- listener shutdown and unchanged local restoration;
- realtime and conflict checks;
- accessibility, responsive, quota, terms, privacy, CI, and Pages validation.

The complete evidence record is [`PHASE_H_RELEASE_VALIDATION.md`](PHASE_H_RELEASE_VALIDATION.md).

## Workspace lifecycle extension status

Delivered:

- owner-only rename;
- monotonic `lifecycleRevision` with expected-revision transactions;
- recoverable archive with retained descendants;
- denied archived content and frozen membership/invitation mutation;
- owner Restore;
- automatic local fallback after active archive;
- visible archived identity/status and safe mobile row layout;
- repaired Open control after Restore;
- interrupted-migration recovery;
- exact local-storage equality across production archive/restore.

Remaining production gates:

1. independent-context rename convergence without refresh;
2. stale lifecycle mutation denial with `REVISION_CONFLICT`;
3. independent-context archive listener shutdown with no reconnect loop;
4. lifecycle-specific editor/viewer/non-member/former/revoked denial;
5. final disposable-fixture disposition and acceptance closeout.

## Spark-plan constraints

- Keep GitHub Pages; do not enable Firebase Hosting/App Hosting.
- Do not add phone authentication, paid email delivery, Cloud Functions, or a custom backend without approval.
- Use the Emulator Suite for automated Rules tests.
- Subscribe only to active data and batch writes where appropriate.
- Surface quota errors and preserve exports.
- Recheck current Firebase pricing, quotas, terms, and organization policy immediately before beta.
- Do not use regulated or institutionally controlled data without separate written approval.

## Next work

Follow `TERRA_NEXT_PHASES_PLAN.md`. Security acceptance and beta readiness take priority over feature growth. No new product feature should be released until lifecycle production acceptance is closed and practical source-budget headroom is restored.
