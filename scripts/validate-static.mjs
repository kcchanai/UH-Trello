import {readFile} from 'node:fs/promises';

const [html, app, core, main, localAdapter, firebaseAdapter, authUI] = await Promise.all([
  'index.html', 'app.js', 'state-core.js', 'src/main.js', 'src/adapters/local-workspace-adapter.js',
  'src/adapters/firebase-workspace-adapter.js', 'src/auth-ui.js'
].map(file => readFile(file, 'utf8')));

const required = [
  ['semantic main landmark', /<main\b/],
  ['primary heading', /<h1\b/],
  ['skip link', /href="#board"/],
  ['live status region', /role="status"/],
  ['native dialogs', /<dialog\b/],
  ['Vite module entry', /type="module"\s+src="\/src\/main\.js"/],
  ['honest cloud status', /id="cloud-status"/],
  ['Google account dialog', /id="account-dialog"/],
  ['explicit local-data safety notice', /Signing in does not upload, merge, replace, or delete/]
];
for (const [label, pattern] of required) if (!pattern.test(html)) throw new Error(`Static validation failed: missing ${label}.`);
if (!app.includes('FlowboardState.cardMatches') || !app.includes('FlowboardState.csvForBoard')) throw new Error('App does not use tested state helpers.');
if (app.includes('localStorage.')) throw new Error('App bypasses the local workspace adapter.');
if (!app.includes('FlowboardRuntime?.localAdapter')) throw new Error('App does not use the local workspace adapter.');
if (!core.includes('module.exports')) throw new Error('State helpers are not testable in Node.');
if (!main.includes('createLocalWorkspaceAdapter') || !localAdapter.includes('loadWorkspace')) throw new Error('Local adapter boundary is incomplete.');
if (!main.includes('createFirebaseWorkspaceAdapter') || !firebaseAdapter.includes('signInWithPopup')) throw new Error('Firebase Authentication boundary is incomplete.');
if (!authUI.includes('Your local workspace was not changed') || !authUI.includes('Your local workspace was not uploaded')) throw new Error('Authentication UI lacks local-data safety handling.');
console.log(`Static validation passed: ${required.length} semantic/runtime guards plus adapter-boundary checks.`);
