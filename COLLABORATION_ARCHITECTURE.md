# Phase 7 collaboration architecture

## Status

Flowboard remains a dependency-free, GitHub Pages-hosted, local-first application. There is **no configured identity provider, database, backend, realtime channel, or credential** in this repository. The `Collaboration plan` dialog is intentionally local-only: it saves per-board planning metadata in browser `localStorage` and provides a local viewer-preview guard. It does not grant access, send invitations, authenticate a person, synchronize a second browser, or secure local data.

The browser state schema is now version 4. Each board can carry this forward-compatible shape:

```json
{
  "collaboration": {
    "access": "private",
    "currentMemberId": "stable-id",
    "members": [
      { "id": "stable-id", "name": "Local owner", "role": "owner", "addedAt": "ISO-8601" }
    ],
    "updatedAt": "ISO-8601"
  }
}
```

Allowed planned roles are `owner`, `editor`, and `viewer`; planned access values are `private`, `shared`, and `read-only`. The viewer preview blocks ordinary in-app local mutations, but it is explicitly not authorization—browser storage can be modified by the device user.

## Decision record

**Recommended path if collaboration becomes a funded product requirement: Supabase.** It best fits a static GitHub Pages client while providing managed authentication, PostgreSQL row-level security (RLS), realtime subscriptions, and an exportable relational data model. A Firebase implementation is viable but has more vendor-specific data/query patterns; a custom API offers maximum control but adds the largest security, operations, and incident-response burden.

| Criterion | Supabase | Firebase | Small custom API |
| --- | --- | --- | --- |
| Authentication / authorization | Managed auth plus PostgreSQL RLS | Managed auth plus Security Rules | Must build and operate |
| Per-board roles | Relational membership table + RLS | Document rules + membership fields | Must build and test |
| Realtime | Postgres changes / presence channels | Firestore listeners | WebSocket or polling service |
| GitHub Pages fit | Public URL + anon client key only | Public web config only | Separate hosted API and CORS |
| Exportability | SQL/Postgres export | Requires planned export pipeline | Depends on implementation |
| Security maintenance | Managed platform, RLS policy review still required | Managed platform, rule review still required | Highest burden |

This is an architecture recommendation, not a deployment decision. Reassess pricing, service limits, data residency, and product privacy requirements against current vendor documentation before implementation.

## Proposed Supabase boundary

Keep all secrets out of this repository and out of GitHub Pages. The browser may receive only intentionally public endpoint/configuration and a public anonymous key. Never expose a service-role key.

1. Create a Supabase project and configure approved sign-in providers and redirect URLs for the GitHub Pages origin.
2. Add a non-committed, deployment-injected public configuration file or build-time environment adapter. Do not add a project URL or key until an owner supplies them.
3. Add tables for `boards`, `board_members`, `lists`, `cards`, `comments`, and append-only `activity_events`; use stable IDs and timestamps already present in local data.
4. Require RLS on every table. Policies must derive access from `auth.uid()` and board membership, never from client-supplied role or board identifiers alone.
5. Expose client operations through a `collaborationAdapter` interface, so local storage remains the default adapter and remote behavior is opt-in only after a valid authenticated session.
6. Subscribe only to boards the session is authorized to read. Use server timestamps, revisions, and an idempotency key for queued mutations.

Suggested adapter surface:

```js
const collaborationAdapter = {
  getSession: async () => null,
  signIn: async () => { throw new Error('Not configured'); },
  signOut: async () => {},
  fetchBoard: async (boardId) => {},
  subscribeToBoard: (boardId, onEvent) => () => {},
  applyMutation: async (mutation) => {},
  importWorkspace: async (workspace) => {}
};
```

The local adapter must continue to work with no account, network, or backend configuration.

## Required server-side model and enforcement

- `board_members(board_id, user_id, role)` is the source of truth for `owner`, `editor`, and `viewer` roles.
- Every board/list/card/comment mutation checks membership on the server. Viewers have read access only; no client-only UI condition can satisfy this requirement.
- Invitations must be server-generated, expiring, single-purpose tokens with rate limits and audit events; do not encode role authority into an unsigned client link.
- Removal/revocation changes membership first, terminates/rejects subscriptions, and rejects subsequent reads and writes immediately.
- Validate input sizes/types server-side; HTML-escape browser rendering as Flowboard already does for user-entered strings.
- Provide retention, export, deletion, privacy, and abuse-reporting policy before accepting personal data.

## Realtime and conflict plan

Use an append-only mutation/event record containing `id`, `boardId`, `actorId`, `clientMutationId`, `baseRevision`, `serverRevision`, `type`, `payload`, and server time. The server serializes board revision changes. Clients apply ordered events, deduplicate by `clientMutationId`, and refetch on a revision gap.

For a conflicting field edit, use explicit last-write-wins only where product-approved; for ordered cards, use a fractional/rank position model and server-side validation. Do not silently overwrite a remote edit. Presence and cursor hints remain ephemeral channels and are not audit records.

## Offline migration and validation gates

1. Keep `flowboard-workspace` as the local source until a signed-in user explicitly chooses a migration.
2. Preview counts and validate the local workspace before upload, just as the current import flow does.
3. Upload in idempotent batches with a migration identifier; retain the local workspace until a verified export/checksum or completion confirmation.
4. Queue offline mutations with client mutation IDs and reconcile after sign-in/reconnect. Show conflict or retry state; never pretend a queued write reached collaborators.
5. Test with two authenticated browsers, direct API attempts as viewer, member revocation, reconnect after offline edits, and cross-board ID tampering before release.

## Phase 7 exit criteria

Do not claim collaboration complete until two authenticated browsers converge on a shared board; viewers are blocked both in UI and direct API requests; revoked members immediately lose access; and local-only use remains available without an account.
