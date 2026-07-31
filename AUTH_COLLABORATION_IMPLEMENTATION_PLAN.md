# Flowboard authenticated collaboration implementation plan

> **Superseded backend direction:** Aaron selected the no-cost Firebase Spark design on 2026-07-30. Phase A in this document remains historical context; use `FIREBASE_COLLABORATION_PLAN.md` for Phase B onward and `FIREBASE_OWNER_SETUP.md` for owner setup.

## Purpose

Evolve Flowboard from a browser-local personal board into an optionally authenticated shared workspace while preserving local-only use, import/export, accessibility, and the existing GitHub Pages experience.

This plan responds to two specific product requirements:

1. An organizer can sign in with a Google account and save a workspace to the cloud.
2. The organizer can add members to that workspace; each member signs in with their own Google account and receives an enforced workspace role.

## Analysis of the current application

### Strengths to preserve

- Static vanilla HTML/CSS/JavaScript application hosted on GitHub Pages.
- Versioned local workspace state (`schemaVersion: 4`) with migration and normalization.
- Multiple boards, rich cards, import/export, local backups, session undo, and accessible dialogs.
- Pure state helpers in `state-core.js`, Node unit tests, Playwright smoke tests, Lighthouse accessibility validation, performance budgets, and GitHub Actions.
- Stable UUID-style identifiers and timestamps already exist for workspaces, boards, lists, cards, members, and activity entries.
- The app can remain useful without an account or network connection.

### Gaps that matter for real collaboration

- `localStorage` is the only persistence mechanism; it cannot synchronize devices or users.
- The current `collaboration` object is stored per board, while the requested membership belongs at the **workspace** level.
- Current members are names and local role previews, not authenticated identities. The viewer guard is UI-only and is not authorization.
- Card assignees are free-text names rather than authenticated workspace-member IDs.
- There is no identity session, remote data adapter, database, row-level policy, invitation lifecycle, realtime subscription, offline mutation queue, or conflict protocol.
- `app.js` still combines state, rendering, persistence, and event handling. Wiring remote operations directly into it would create dual-source-of-truth bugs.
- GitHub Pages can host the client, but it cannot safely hold privileged credentials or execute trusted invitation/account logic.

## Architecture decision

### Recommendation: Supabase + Google OAuth

Use Supabase for managed Google authentication, PostgreSQL storage, row-level security (RLS), realtime updates, and narrowly scoped server functions/RPCs. Keep the UI in vanilla JavaScript, but introduce ES modules and a small Vite build so the Supabase SDK, environment-specific public configuration, and tests are deterministic.

Why this best fits Flowboard:

- PostgreSQL tables express workspace membership and role checks clearly.
- RLS can enforce every read/write against `auth.uid()` and workspace membership.
- Realtime can subscribe to authorized workspace/board changes.
- Google OAuth works with a static GitHub Pages redirect origin.
- Data remains exportable as relational records rather than being locked into a document-only model.
- The browser receives only the Supabase project URL and publishable/anonymous key. Those values identify the public client and are not secrets; the service-role key must never enter GitHub Pages or the repository.

Firebase is a viable alternative, especially for Google sign-in and realtime listeners, but workspace role rules and relational membership queries are easier to audit in PostgreSQL/RLS. A custom API would add unnecessary authentication, WebSocket, deployment, and security-operations burden at this stage.

Before implementation, Terra should verify the current vendor setup steps and limits against official documentation:

- Google sign-in: https://supabase.com/docs/guides/auth/social-login/auth-google
- Row-level security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Realtime: https://supabase.com/docs/guides/realtime

## Product decisions

- Local-only use remains available without signing in.
- Signing in does not silently upload local data. The organizer explicitly chooses **Create cloud workspace** or **Upload this local workspace** after a count-based preview.
- Membership is workspace-wide. Roles are `owner`, `editor`, and `viewer`.
- Owners manage members and workspace settings. Editors mutate boards/lists/cards/comments. Viewers read only.
- An invite is addressed to a normalized Google-account email. Access is granted only after that exact verified email signs in and the server accepts the invitation.
- The first release may provide a copyable invitation link rather than transactional email. Email delivery can be added later through an Edge Function and provider after domain/privacy decisions.
- The browser never decides authorization from cached role data. UI controls reflect role for usability, but RLS/RPCs are the authority.
- Local collaboration-plan data is migration input only; it must not become authenticated membership automatically.

## Target data model

All IDs are UUIDs; all mutable rows have `created_at`, `updated_at`, and a revision/order field where appropriate.

- `profiles`
  - `id` references `auth.users.id`
  - `email`, `display_name`, `avatar_url`
- `workspaces`
  - `id`, `name`, `owner_user_id`, `revision`, timestamps
- `workspace_members`
  - `workspace_id`, `user_id`, `role`, `status`, `joined_at`
  - unique `(workspace_id, user_id)`
- `workspace_invites`
  - `id`, `workspace_id`, normalized `email`, `role`, `token_hash`, `created_by`, `expires_at`, `accepted_at`, `revoked_at`
  - never store a reusable plaintext token
- `boards`
  - `id`, `workspace_id`, `title`, appearance fields, `position`, archive state, `revision`
- `lists`
  - `id`, `board_id`, `title`, `position`, archive state, `revision`
- `cards`
  - `id`, `list_id`, `title`, `description`, due fields, `position`, archive state, structured label/checklist metadata, `revision`
- `card_assignees`
  - `card_id`, `user_id`; membership must exist in the card's workspace
- `comments`
  - `id`, `card_id`, `author_user_id`, `body`, timestamps, soft-delete state
- `activity_events`
  - append-only `id`, `workspace_id`, `board_id`, `actor_user_id`, `client_mutation_id`, `event_type`, safe payload, server timestamp, server revision
- `workspace_mutations` or equivalent idempotency record
  - unique `(workspace_id, client_mutation_id)` to prevent duplicate replay

Use sortable rank/position values for boards, lists, and cards. Do not rely on client array index as the remote ordering authority.

## Security baseline

- Enable RLS on every application table before inserting real user data.
- Derive access through `auth.uid()` and `workspace_members`; never trust a client-supplied role.
- Only owners can create/revoke invites, change roles, remove members, or delete a workspace.
- Owners cannot remove/demote the last owner without transferring ownership atomically.
- Editors can mutate content but cannot manage membership.
- Viewers cannot mutate through either the UI or direct REST/RPC calls.
- Invitation acceptance must happen in a transactional server RPC/function that verifies signed-in email, expiry, revocation, intended role, and one-time use.
- Normalize email consistently on the server. Do not reveal whether arbitrary emails have accounts.
- Validate field lengths, enum values, parent-child relationships, and workspace membership server-side.
- Never expose the Supabase service-role key, Google client secret, SMTP/API keys, or invitation-signing secret in client assets or GitHub Actions logs.
- Configure exact OAuth redirect URLs for local development and `https://kcchanai.github.io/UH-Trello/`.
- Add privacy, data export, workspace deletion, and account-deletion behavior before inviting external users.

# Multi-phase implementation roadmap

## Phase A — Remote boundary and build transition

**Goal:** Prepare the current app for a second persistence adapter without changing user-visible data behavior.

1. Create ES modules for domain state, local persistence, mutations, rendering, and transport adapters.
2. Define a typed/documented adapter contract:
   - `getSession`, `onAuthStateChange`, `signInWithGoogle`, `signOut`
   - `listWorkspaces`, `fetchWorkspace`, `subscribeWorkspace`
   - `createWorkspace`, `applyMutation`, `inviteMember`, `acceptInvite`, `changeMemberRole`, `removeMember`
   - `uploadLocalWorkspace`, `exportRemoteWorkspace`
3. Implement and test `LocalWorkspaceAdapter` first; current local workflows must remain unchanged.
4. Add Vite only for deterministic modules/environment injection. Configure GitHub Pages base path `/UH-Trello/` and deploy built static assets through Actions.
5. Add runtime configuration detection. When Supabase public configuration is absent, hide/disable cloud controls with honest explanatory text while local mode remains fully usable.
6. Expand tests around adapter parity and ensure no persistence code bypasses the adapter.

**Exit criteria:** Current local features, imports, exports, migrations, browser smoke tests, Lighthouse, and GitHub Pages all pass through the local adapter.

## Phase B — Supabase project, schema, and policy test harness

**Goal:** Establish a server-enforced data layer before adding sign-in UI.

1. Aaron creates/owns the Supabase project and Google OAuth credentials, or explicitly grants Terra access to create them.
2. Add version-controlled Supabase SQL migrations under `supabase/migrations/` for profiles, workspaces, members, invites, boards, lists, cards, assignees, comments, activity, revisions, and idempotency.
3. Add indexes for membership checks, workspace/board foreign keys, updated timestamps, and ordered records.
4. Add RLS helper functions and policies for owner/editor/viewer behavior.
5. Add transactional RPCs for workspace creation, invitation creation/acceptance, role changes, last-owner protection, member removal, and ordered mutations.
6. Add database tests covering anonymous denial, cross-workspace isolation, viewer write denial, editor membership denial, owner membership management, invite expiry/reuse, revocation, and ID tampering.
7. Seed only disposable development fixtures—never real emails or secrets.

**Exit criteria:** Policy tests prove authorization independently of the UI. A direct API request cannot bypass workspace roles.

## Phase C — Google sign-in and account shell

**Goal:** Let a person establish an authenticated session without forcing cloud migration.

1. Add **Continue with Google**, session restoration, avatar/name, sign-out, expired-session, popup-blocked, and OAuth-error states.
2. Use the Supabase PKCE OAuth flow and exact local/production redirect allowlists.
3. Create/update the `profiles` row from verified auth metadata using a server-safe trigger or constrained RPC.
4. Add an account/workspace switcher distinguishing:
   - Local workspace on this device
   - Cloud workspaces owned by or shared with the signed-in user
5. Do not overwrite local state on sign-in or sign-out.
6. Provide clear offline and reconnect status; cached remote data must never be presented as successfully synced when it is only local.

**Exit criteria:** Google sign-in works on local preview and GitHub Pages; session survives reload; sign-out removes remote access while preserving local data.

## Phase D — Organizer cloud workspace and local migration

**Goal:** Let the organizer save the existing workspace to the authenticated account.

1. Add **Create cloud workspace** and **Upload local workspace** flows.
2. Validate and preview board/list/card counts before upload.
3. Map the current schema to remote rows in idempotent batches with a migration ID and client mutation IDs.
4. Preserve stable IDs when safe; remap collisions transactionally.
5. Convert free-text assignees only when the organizer explicitly maps them to authenticated members; otherwise preserve them as non-member display metadata until resolved.
6. Do not convert the local collaboration-plan member names into real accounts.
7. Verify remote counts/revisions after upload, then offer to keep or archive the local copy. Never delete local data automatically.
8. Add remote export back to Flowboard JSON.

**Exit criteria:** The organizer can sign in on a second browser and see an equivalent cloud workspace; local data remains recoverable and exportable.

## Phase E — Workspace invitation and member administration

**Goal:** Let an organizer add Google-account members with enforced roles.

1. Add a workspace Members dialog listing owner/editor/viewer, avatar, email, status, and joined time.
2. Owner enters an email and role. The server creates a one-time, expiring invite and returns a copyable invitation URL.
3. The invitee opens the link, signs in with Google, and can accept only if the verified Google email matches the invitation.
4. Add pending, expired, accepted, revoked, resend/replace, and cancel states without leaking account-existence information.
5. Add role changes, member removal, self-leave, and atomic ownership transfer/last-owner protection.
6. Replace card free-text assignee entry with selection from accepted workspace members while displaying legacy free-text values safely.
7. Record member/invitation actions in the server activity trail.
8. Add optional email sending only after a domain/sender and privacy policy are configured; keep privileged mail credentials in an Edge Function, never the client.

**Exit criteria:** An owner invites a second Google account; the member accepts; roles survive reload; unauthorized role/member changes fail through direct API calls.

## Phase F — Shared board CRUD and realtime convergence

**Goal:** Make authenticated cloud workspaces genuinely collaborative.

1. Route all cloud mutations through the remote adapter and optimistic mutation queue.
2. Apply server revisions, client mutation IDs, and idempotent retries.
3. Subscribe to authorized workspace changes and update targeted DOM/state rather than replacing unsynced local edits.
4. Use sortable ranks for reorder; add a deterministic rebalancing strategy.
5. Define conflict behavior:
   - ordered server revisions for structural mutations
   - explicit last-write-wins only for approved scalar fields
   - visible conflict/reload choice for concurrent rich card edits
6. Show `Saving`, `Synced`, `Offline—changes queued`, `Retrying`, and `Conflict` states truthfully.
7. Revalidate/refetch after revision gaps, reconnects, role changes, or membership revocation.
8. Immediately unsubscribe and clear inaccessible remote data when membership is removed.

**Exit criteria:** Two authenticated browsers converge after create/edit/move/archive operations; duplicate retries do not duplicate data; viewers and revoked users cannot mutate or continue reading.

## Phase G — Collaboration features

**Goal:** Add the team interactions that depend on secure shared state.

1. Replace local-only activity entries with actor-attributed server events in cloud mode.
2. Add card comments, editing/deletion rules, and safe mention parsing.
3. Add presence as ephemeral realtime state; do not store it as an audit record.
4. Add in-app notifications for assignment, mention, invite, and relevant card changes.
5. Add notification preferences before email/browser push.
6. Rate-limit invitations, comments, mentions, and notification fan-out.
7. Retain local activity behavior in local mode.

**Exit criteria:** Comments and activity identify authenticated actors; mentions only target current members; presence expires cleanly; abuse limits are tested.

## Phase H — Offline, security, accessibility, and production release

**Goal:** Validate the shared product as a secure release rather than a demo.

1. Test offline queues, reconnect, idempotency, revision gaps, and conflict UI.
2. Add end-to-end tests with owner/editor/viewer accounts in isolated test projects.
3. Add direct REST/RPC negative tests for cross-workspace IDs, viewer writes, expired invites, removed members, and forged roles.
4. Re-run keyboard, dialog, screen-reader-context, 320 px, 200% zoom, forced-colors, reduced-motion, Lighthouse, and performance tests for every new auth/member/sync state.
5. Add CSP and other applicable static response/meta hardening compatible with OAuth and Supabase endpoints.
6. Audit logging, error telemetry with personal-data redaction, retention, export, workspace deletion, and account deletion.
7. Review current Supabase/Google quotas, pricing, data location, terms, and privacy obligations.
8. Tag a collaboration beta only after two-browser convergence and authorization gates pass on the deployed environment.

**Exit criteria:** All security, two-browser, offline, accessibility, privacy, and deployment checks pass; the documentation no longer describes cloud collaboration as unavailable.

## Implementation discipline for Terra

- Complete one phase at a time and keep each phase independently deployable.
- Send a concise update after each phase, then continue automatically unless credentials, account ownership, billing, OAuth consent, or another genuinely external decision blocks progress.
- Never claim a phase is complete from code inspection alone. Run unit, syntax, browser, accessibility, policy, and deployed-site checks applicable to that phase.
- Never fabricate Supabase project IDs, keys, Google OAuth credentials, emails, policy-test results, realtime convergence, or deployments.
- Keep secrets outside Git. Commit `.env.example`, not `.env`.
- Use separate development/test and production Supabase projects before handling real workspaces.
- Preserve local mode and existing exports until remote migration has been proven reversible.
- Update README, architecture decisions, validation checklist, release notes, and schema/migration documentation in every phase.

## External prerequisites Aaron must supply or authorize

Terra can complete Phase A without external credentials. Phase B and later require:

1. A Supabase organization/project owned by Aaron, plus permission for Terra to configure it.
2. A Google Cloud OAuth client with approved JavaScript origins and redirect URLs, or permission for Terra to create/configure it.
3. Public client configuration for local and GitHub Pages environments.
4. A decision on whether invite delivery is copy-link only for the first release or uses a configured email sender/domain.
5. Test Google accounts representing owner, editor, and viewer for full acceptance tests.
6. Privacy/retention/account-deletion decisions before inviting real users.

These are real external boundaries, not implementation details Terra should guess.

## Definition of done

Authenticated collaboration is complete only when:

- An organizer signs in with Google and explicitly uploads or creates a cloud workspace.
- A second Google account accepts an email-matched invitation.
- Owner/editor/viewer permissions are enforced by the server and verified through direct unauthorized requests.
- Two browsers converge on shared board changes.
- Revoked users immediately lose subscriptions and API access.
- Offline/retry/conflict states are truthful and tested.
- Local-only mode, export, and recovery continue to work.
- Automated unit, database-policy, browser, accessibility, and deployed smoke tests pass.
- GitHub Pages and backend production configuration are verified without exposing privileged credentials.
