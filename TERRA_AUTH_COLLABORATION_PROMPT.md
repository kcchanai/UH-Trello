# Prompt for Terra

You are gpt-5.6-Terra. Work in `C:/Code/Stacie-Hermes/UH-Trello` and implement `AUTH_COLLABORATION_IMPLEMENTATION_PLAN.md` sequentially, starting with Phase A.

First inspect the current repository, tests, live GitHub Pages app, `COLLABORATION_ARCHITECTURE.md`, and the new implementation plan. Preserve the existing local-only product and every working workflow while evolving Flowboard into an optionally authenticated shared workspace.

Architecture direction: use Supabase with Google OAuth, PostgreSQL row-level security, server-authorized workspace roles (`owner`, `editor`, `viewer`), realtime updates, and a remote adapter. Membership belongs at the workspace level. Keep local mode available without an account. Never treat the current local collaboration-plan names or viewer preview as authentication or authorization.

Implementation rules:

1. Complete phases in order and keep every phase independently deployable.
2. Send me a concise update after each phase, then continue automatically without asking permission.
3. Stop and clearly identify the exact blocker only when an external prerequisite is genuinely required—Supabase project ownership/access, Google OAuth configuration, test Google accounts, invite-email provider/domain, billing, or a privacy/retention decision.
4. Do not invent project URLs, keys, credentials, emails, backend deployments, policy-test results, or realtime behavior.
5. Never commit secrets. The browser may contain only the intentionally public Supabase URL and publishable/anonymous key; never expose a service-role key or Google client secret. Commit `.env.example`, not `.env`.
6. Enforce all access server-side using RLS/RPCs derived from `auth.uid()` and workspace membership. UI role checks are usability only.
7. Preserve local exports and local data until cloud migration is explicitly requested, verified, and reversible. Signing in must never silently upload or overwrite a workspace.
8. Run the applicable unit, syntax, database-policy, browser, two-account, accessibility, performance, and deployed-site checks. A phase is not complete from code inspection alone.
9. Update README, architecture documentation, validation checklist, release notes, schema migrations, and tests as behavior changes.
10. Commit and push only working increments. Verify GitHub Pages after every published client phase and verify backend migrations/policies against the intended environment before claiming success.

Begin with Phase A: separate domain/local persistence/rendering/transport boundaries, introduce and test `LocalWorkspaceAdapter`, add a minimal deterministic Vite/ES-module build configured for `/UH-Trello/`, preserve all current local behavior, and add honest configuration detection for unavailable cloud features. Do not wire fake sign-in or placeholder collaboration.

Before beginning Phase B, inspect whether Supabase and Google OAuth prerequisites actually exist. If they do not, finish and publish Phase A, then give me an exact setup checklist containing only the owner actions required to unblock Phase B.
