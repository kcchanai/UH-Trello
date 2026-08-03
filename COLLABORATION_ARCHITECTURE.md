# Flowboard Firebase collaboration architecture

## Status

Flowboard is a GitHub Pages-hosted, local-first application with real Firebase Google Authentication and an authenticated shared Firestore workspace. G3 authenticated comments are deployed and owner/editor/viewer UI acceptance is complete. Phase H direct Firestore authorization, revocation, privacy, quota, and final release evidence remain in progress.

The complete, current order of work is [`TERRA_NEXT_PHASES_PLAN.md`](TERRA_NEXT_PHASES_PLAN.md). This document records the selected architecture and the constraints future work must preserve.

## Decision record

**Selected architecture:** Firebase Authentication (Google provider) + Cloud Firestore Standard edition + Firebase Security Rules, with GitHub Pages/Vite continuing as the static host.

| Criterion | Firebase selected design | Shared Drive JSON | Small custom API |
| --- | --- | --- | --- |
| Authentication | Firebase Google Auth and stable `uid` | Browser Google tokens and ACLs | Must build/operate |
| Server authorization | Firestore Rules and workspace membership | File ACLs, weak per-record enforcement | Must build/test every endpoint |
| Realtime structured edits | Active-board Firestore listeners | Polling or whole-file replacement | WebSockets/polling service |
| GitHub Pages fit | Public Firebase Web config only | Browser-access tokens required | Separate hosted API and CORS |
| Spark/no-cost start | Bounded Auth and Firestore quota | Storage/API quota | Hosting/operations cost |
| Operations | Rules/indexes plus quota review | Token/ACL/revision management | Highest security/incident burden |

Firebase public Web App fields identify the browser application; they are not secrets and do not authorize access. Service-account JSON, Admin SDK credentials, OAuth client secrets, private keys, passwords, Firebase CI tokens, and real `.env` files are prohibited from this repository and browser bundle.

## Authorization model

Membership is attached to a workspace, never a board.

```text
roles:
  owner  — workspace lifecycle, membership, invitations, ownership transfer, content administration
  editor — workspace content create/edit/move/archive
  viewer — workspace content read only
```

A project-level Google Cloud/Firebase Owner is distinct from a Flowboard workspace `owner`.

### Firestore paths

```text
users/{uid}

workspaces/{workspaceId}
workspaces/{workspaceId}/members/{uid}
workspaces/{workspaceId}/invites/{inviteId}
workspaces/{workspaceId}/boards/{boardId}
workspaces/{workspaceId}/boards/{boardId}/lists/{listId}
workspaces/{workspaceId}/boards/{boardId}/cards/{cardId}
workspaces/{workspaceId}/boards/{boardId}/cards/{cardId}/comments/{commentId}
workspaces/{workspaceId}/activity/{eventId}
```

Cards are sibling documents to lists and carry `listId` plus a sortable rank. This allows a card move to be one atomic update rather than a cross-subcollection delete/create.

### Invitation model

The first invitation release uses a copyable link. The link includes random workspace/invitation identifiers but is not authority by itself.

1. An owner creates a random, expiring editor/viewer invitation for a normalized Google email.
2. The owner sends the copied link using an existing communication channel; no paid email service or Cloud Function is required.
3. The recipient signs in with Firebase Google Auth.
4. Rules permit reading/accepting only if the authenticated verified email exactly matches the active invitation.
5. Acceptance atomically creates the member document and marks that invitation accepted by the same UID.
6. Revocation is a durable state; the link becomes unreadable/unacceptable.

Ordinary member edits cannot create or promote an `owner`. A dedicated atomic ownership-transfer operation changes `workspace.ownerUid`, promotes an existing editor/viewer, and demotes the previous owner. It must never leave zero owners.

## Phase H direct authorization and release validation

The current Phase H runbook is [`PHASE_H_RELEASE_VALIDATION.md`](PHASE_H_RELEASE_VALIDATION.md). It is the source of the direct REST probe, separate owner/editor/viewer/non-member matrix, revocation checks, privacy record, and final release evidence requirements.

Client controls are usability only. Production authorization evidence must come from authenticated direct Firestore requests and the published Rules revision. Hard deletion of cloud parents and comments is denied; cloud cards are archived and comments are soft-removed so nested comment records do not become unauthorized orphan data.

## Local/cloud boundary and migration

`flowboard-workspace` and its browser recovery/export tooling remain the local source of truth unless a person explicitly selects a cloud action.

The cloud-copy migration is intentionally two-stage:

1. Preview local board/list/card counts and serialized size.
2. Require a timestamped local JSON download before writes are enabled.
3. Bootstrap workspace, authenticated owner membership, and the owner's profile reference in one authorized batch.
4. Upload content in a separate bounded batch after membership exists.
5. Read back workspace metadata and board IDs/counts before reporting success.
6. Leave the browser-local original active. The compact status **Cloud copy · local** means the cloud copy was verified while local persistence remains active.

Cloud workspace switching, preview, and editing are later phases. There is no implicit migration and no automatic synchronization.

## Realtime, conflicts, and revocation plan

Do not subscribe to an entire account or every board. Shared editing will subscribe only to the active workspace, current membership, and active board/list/card data, then unsubscribe promptly on selection changes, sign-out, role loss, or removal.

Each cloud mutation will use:

- an opaque `clientMutationId` for idempotency/activity correlation;
- integer document revision and transaction precondition checks;
- server timestamps;
- atomic batches for linked structural updates;
- sortable/fractional ranks with bounded rebalance batches for order changes.

A stale revision must surface a reload/reapply conflict state rather than silently overwrite another person's edit. Pending, synced, offline, retrying, and access-removed states must be truthful.

The initial shared release should use memory-only Firestore state rather than persistent disk caching. Persistent cloud caching can retain content after a membership revocation and requires a separate privacy/revocation design before adoption.

## Validation and release gates

Client UI hiding is usability only. Before collaboration is called secure or ready, validate both the Firestore Emulator and deployed direct Firestore calls from separate real Google accounts:

- anonymous denial;
- owner/editor/viewer positive and negative operations;
- non-member and cross-workspace isolation;
- malformed/forged IDs;
- email-matched, unverified, expired, revoked, and reused invitation cases;
- self-leave, member removal, ownership transfer, and last-owner protection;
- viewer direct-write denial;
- immediate revocation while listeners are active;
- two-browser convergence, conflicts, offline/reconnect, and mutation deduplication.

Every collaboration milestone also requires local-only regression checks, keyboard/focus behavior, responsive widths, reduced motion/forced colors, Lighthouse accessibility, performance budgets, successful CI, and a cache-busted GitHub Pages console check.

## Operational and privacy constraints

- Keep GitHub Pages. Firebase Hosting and App Hosting are not needed.
- Do not use Cloud Functions, phone authentication, paid email delivery, or a custom server in the initial release.
- Spark quotas are bounded and subject to change; review official Firebase pricing before beta.
- Batch reorders, avoid presence heartbeats unless justified, and surface quota failures instead of losing writes.
- Before accepting institutional, FERPA-covered, employment, or other controlled data, obtain the appropriate UH approval. The project's `Unmanaged` parent does not itself guarantee independence from institutional policy.
- Before release, document exports, deletion, retention, membership visibility, account-data handling, and redacted diagnostics.
