# Release notes

## Current collaboration and lifecycle release

- Firebase-authenticated owner/editor/viewer collaboration, granular revision-aware editing, realtime convergence, activity, assignments, comments, invitations, member administration, revocation, and ownership transfer are deployed.
- Owner-only workspace rename and recoverable archive/Restore retain descendants, deny archived content access, return active sessions to independent local data, and keep parent hard deletion denied.
- The last behavior-changing lifecycle client release is `0b97993b43093e6cb0ccdda1a706d3e2f8d2b391` (`Restore cloud workspace open control`).
- Production owner archive/Restore, retained-content reopening, visual local restoration, and exact localStorage equality passed. Independent-context and lifecycle-specific role gates remain in `TERRA_NEXT_PHASES_PLAN.md`.
- Current released source usage is 209,979 of 210,000 bytes. New feature development is frozen until practical headroom is restored.
- The current repository checkpoint passes 20 application/tooling tests, 23 Firestore Rules tests, and 9 browser checks. New regressions verify the exact stale-lifecycle message and one-time listener shutdown without reconnect after archive-style permission loss.

## Phase 8 — Performance, testing, and release maturity

- Added a dependency-free `state-core.js` boundary for versioned state helpers used by Flowboard filtering, CSV export, and import validation.
- Added Node built-in unit coverage for migration/normalization, filtering, import recognition, CSV quoting, and bounded undo snapshots.
- Added Chromium browser smoke tests for card creation + reload persistence and card-dialog Escape/focus return.
- Added a GitHub Actions validation workflow for pull requests and `main`: unit/syntax/static checks, static asset budgets, browser workflows, and a Lighthouse accessibility gate.
- Established initial static asset budgets: 140 KB total across `index.html`, `styles.css`, `state-core.js`, and `app.js`; individual file ceilings are enforced in `scripts/validate-performance.mjs`.

## Dependency decision

The published application uses the pinned modular Firebase Web SDK for optional authenticated collaboration. The local-first UI remains vanilla HTML, CSS, and JavaScript with no framework runtime. Playwright and Lighthouse are installed **ephemerally in GitHub Actions only** for browser/accessibility validation and are not shipped to browsers.

## Release procedure

Run locally:

```bash
npm test
npm run check
```

GitHub Actions additionally runs the browser smoke tests and Lighthouse accessibility audit against a temporary local static server. Pages deployment is separately smoke-tested after each release because a successful push is not deployment proof.
