# Release notes

## Phase 8 — Performance, testing, and release maturity

- Added a dependency-free `state-core.js` boundary for versioned state helpers used by Flowboard filtering, CSV export, and import validation.
- Added Node built-in unit coverage for migration/normalization, filtering, import recognition, CSV quoting, and bounded undo snapshots.
- Added Chromium browser smoke tests for card creation + reload persistence and card-dialog Escape/focus return.
- Added a GitHub Actions validation workflow for pull requests and `main`: unit/syntax/static checks, static asset budgets, browser workflows, and a Lighthouse accessibility gate.
- Established initial static asset budgets: 140 KB total across `index.html`, `styles.css`, `state-core.js`, and `app.js`; individual file ceilings are enforced in `scripts/validate-performance.mjs`.

## Dependency decision

The published application remains dependency-free: all production assets are plain HTML, CSS, and JavaScript. Playwright and Lighthouse are installed **ephemerally in GitHub Actions only** for browser/accessibility validation. They are mature MIT-licensed developer tools and are intentionally not shipped to browsers, so they add no runtime payload or production attack surface.

## Release procedure

Run locally:

```bash
npm test
npm run check
```

GitHub Actions additionally runs the browser smoke tests and Lighthouse accessibility audit against a temporary local static server. Pages deployment is separately smoke-tested after each release because a successful push is not deployment proof.
