# Flowboard privacy and data boundaries

Last reviewed: 2026-08-02

## Scope

Flowboard is a local-first project board with optional Firebase-authenticated cloud collaboration. GitHub Pages serves the static application. Firebase Authentication provides Google sign-in, and Cloud Firestore stores explicitly created cloud workspaces.

This document describes the current product behavior. It is not a promise that Flowboard is approved for institutional or regulated data.

## Local data

- The browser-local workspace is stored under `flowboard-workspace`. Older `flowboard-data` content is migrated locally.
- Signing in does not upload, merge, replace, synchronize, or delete browser-local data.
- Creating a cloud copy is explicit, previewed, backup-first, and verified. The local original remains available.
- Up to five rotating recovery snapshots may be retained in the same browser storage. Undo history is session-only.
- Clearing browser storage, using private browsing, device loss, or browser policy can remove local data. Downloaded exports are the user’s responsibility after download.
- Returning from cloud mode reloads the browser-local workspace rather than retaining cloud content as local state.

## Google and Firebase identity data

Firebase Authentication supplies the signed-in account’s UID, display name, email address, email-verification state, and optional profile photo URL to the browser session.

Flowboard stores the following identity-related fields in Firestore where needed for authorization and discovery:

- UID;
- normalized email address;
- display name;
- workspace membership role;
- workspace references;
- membership and update timestamps.

Current workspace members can view membership records, including member identity fields and roles. Workspace owners can create and manage invitations, including the intended recipient’s normalized email and requested role. Invitation links contain opaque workspace and invitation identifiers, but the link alone does not grant access. Acceptance requires the matching verified Google account and deployed Firestore Rules authorization.

Do not post invitation links publicly. Revoke an invitation if it is exposed or no longer needed.

## Cloud workspace content

An explicitly created cloud workspace can contain:

- workspace and board metadata;
- lists and cards;
- card descriptions, labels, due data, checklists, and member-backed assignment UIDs;
- authenticated comments;
- privacy-minimal activity records;
- membership and invitation lifecycle records.

Activity records are authorization-independent audit/display history. They contain bounded action codes, actor UID, entity identifiers, mutation identifiers, and server timestamps. They do not contain titles, descriptions, comment bodies, emails, invitation data, or document payloads.

Legacy `card.activity` arrays belong to the browser-local format. They are not authenticated cloud activity and must not be treated as authoritative identity history.

## Authorization and visibility

Workspace membership is workspace-scoped. Deployed Firestore Security Rules, not hidden or disabled controls, enforce access:

- owner: workspace lifecycle, membership, invitations, roles, content administration, comments, and ownership transfer;
- editor: cloud-content editing and commenting;
- viewer: read-only workspace access;
- non-member and anonymous sessions: denied unless a narrowly scoped invitation operation explicitly applies.

A removed member loses direct reads, writes, and listeners. On reconnect, Flowboard verifies current membership against the server before restarting listeners and returns to the unchanged local workspace when access is gone.

## Retention, removal, and deletion limits

- Comment removal is soft removal. The active body is cleared, while a minimal tombstone and matching activity evidence remain.
- Cloud cards are archived rather than hard-deleted.
- Client hard deletion of workspaces, boards, lists, cards, comments, invitations, and activity records is denied. Firestore does not cascade descendant deletion, so allowing parent deletion could strand inaccessible child records.
- Revoked and accepted invitation state may remain as lifecycle evidence.
- Activity records are append-only and cannot be edited or deleted by clients.
- Member removal and self-leave revoke access. Ownership must be transferred before an owner can cease being the owner.
- Signing out does not delete cloud data or browser-local data.
- A complete cloud-workspace purge is not available in this release. Do not use Flowboard for content whose required retention or deletion schedule cannot tolerate these limits.

## Export behavior

Flowboard supports browser-local workspace and board JSON exports and board CSV export. Cloud workspace export is explicit and does not silently merge into browser-local state. Export files can contain personal or project content and are outside Flowboard’s control after download. Store and share them appropriately.

## Offline and cache behavior

Persistent Firestore disk caching is disabled. Flowboard does not enable IndexedDB persistence, multi-tab persistent caching, or unlimited cache settings.

The Firestore Web SDK can hold a transient write in memory while a tab is offline. Such a promise is not reported as synced. It is lost when the page process ends, and server Rules still authorize it on reconnect. Production revocation testing confirmed that an offline queued batch from a removed editor was rejected with `permission-denied`, rolled back, and never appeared in production.

## Diagnostics and redaction

Release and support evidence must retain only sanitized pass/fail results, operation categories, counts, and authorization error codes. Do not copy or retain:

- credentials, tokens, cookies, or browser authentication storage;
- Firebase configuration values in diagnostic reports;
- invitation links or invitation identifiers;
- account emails or UIDs;
- production workspace, board, card, comment, or mutation identifiers;
- comment bodies, card contents, complete request/response payloads, or full console logs.

## Institutional and controlled-data boundary

The Firebase project is associated with a `hawaii.edu` Google Workspace account under an `Unmanaged` parent. That fact does not provide UH approval and does not make Flowboard an official UH service.

Do not use Flowboard for FERPA-covered, institutional, employment, health, financial, export-controlled, confidential, or other regulated data without separate written approval from the appropriate UH authority and a completed security, privacy, records-retention, accessibility, account-lifecycle, and vendor-terms review.

The project’s continued availability can depend on the institutional Google account, organization policy, and Firebase project ownership. Owners must plan exports and account succession before beta use.

## Spark plan quota and terms review

Official Firebase documentation was reviewed on 2026-08-02. Current published Cloud Firestore free quota includes:

- one free database per project;
- 1 GiB stored data;
- 50,000 document reads per day;
- 20,000 document writes per day;
- 20,000 document deletes per day;
- 10 GiB outbound data transfer per month.

Quotas reset on Firebase’s documented schedule and can change. Features such as TTL deletion, point-in-time recovery, backups, restores, and clones require billing and are not part of this Spark design. Firebase Authentication with Identity Platform currently lists 3,000 tier-1 daily active users on the no-cost Spark plan.

Flowboard limits comment pages to 25, listens only to the active workspace/board/card surfaces, avoids presence heartbeats, and writes one privacy-minimal activity record with each real cloud mutation. Owners must monitor Firestore usage in the Firebase console and stop or redesign beta use before approaching daily or storage limits. The application does not guarantee remaining quota or uninterrupted service.

Official references:

- https://firebase.google.com/docs/firestore/quotas
- https://firebase.google.com/pricing
- https://firebase.google.com/docs/auth/limits
- https://firebase.google.com/terms

The Firebase terms page links the applicable Google APIs Terms of Service and Firebase Data Processing and Security Terms. This review records the source and product boundary only. It is not legal approval, procurement approval, or an institutional data-processing determination.
