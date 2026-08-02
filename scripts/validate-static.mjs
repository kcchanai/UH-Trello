import {readFile} from 'node:fs/promises';

const [html, app, core, main, localAdapter, firebaseAdapter, cloudAdapter, authUI, cloudUI, inviteUI, membersUI, cloudSync, activityUI, assignmentUI, commentsUI] = await Promise.all([
  'index.html', 'app.js', 'state-core.js', 'src/main.js', 'src/adapters/local-workspace-adapter.js',
  'src/adapters/firebase-workspace-adapter.js', 'src/adapters/firebase-cloud-workspace.js',
  'src/auth-ui.js', 'src/cloud-workspace-ui.js', 'src/invite-ui.js', 'src/members-ui.js', 'src/cloud-sync-controller.js', 'src/activity-ui.js', 'src/assignment-ui.js', 'src/comments-ui.js'
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
  ['explicit cloud migration dialog', /id="cloud-migration-dialog"/],
  ['cloud workspace preview dialog', /id="cloud-workspaces-dialog"/],
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
if (!firebaseAdapter.includes('firebase-cloud-workspace.js') || !cloudAdapter.includes('MIGRATION_VERIFICATION_FAILED')) throw new Error('Verified cloud migration adapter is incomplete.');
if (!cloudUI.includes('flowboard-before-cloud-') || !cloudUI.includes('still using the local original')) throw new Error('Cloud migration UI lacks backup-first local safety handling.');
if (!app.includes('openCloudPreview') || !app.includes("activeWorkspace.kind !== 'local'") || !cloudUI.includes('read-only cloud preview')) throw new Error('Cloud preview does not preserve the local-only boundary.');
if (!html.includes('workspace-members-dialog') || !inviteUI.includes('acceptInvite') || !membersUI.includes('transferOwnership')) throw new Error('Secure membership administration UI is incomplete.');
if (!firebaseAdapter.includes('subscribeWorkspace') || !cloudAdapter.includes('onSnapshot') || !cloudSync.includes("window.addEventListener('offline'") || !cloudSync.includes('handleCloudAccessRemoved')) throw new Error('Realtime cloud lifecycle boundary is incomplete.');
if (!app.includes("$('#close-card-dialog').disabled = false")) throw new Error('Viewer card dialogs must retain a working visible close button.');
if (!html.includes('cloud-activity-dialog') || !activityUI.includes('listActivity') || !activityUI.includes('pageSize:25') || !activityUI.includes('text.textContent')) throw new Error('Authenticated activity feed is incomplete or unbounded.');
if (!html.includes('cloud-assignees-field') || !app.includes('assigneeUids') || !assignmentUI.includes('listMembers') || !assignmentUI.includes('checked.length>8') || !assignmentUI.includes('text.textContent')) throw new Error('Member-backed cloud assignment controls are incomplete or unsafe.');
if (!html.includes('cloud-comments-section') || !firebaseAdapter.includes('subscribeComments') || !cloudAdapter.includes("limit(safeSize)") || !commentsUI.includes('pageSize:25') || !commentsUI.includes('textContent') || !commentsUI.includes('MutationObserver')) throw new Error('Authenticated card comments are incomplete, unsafe, or not active-card scoped.');
if (!app.includes("Archive this cloud card?") || !app.includes("Cloud lists cannot be permanently deleted") || !app.includes("Cloud workspaces cannot be reset") || !app.includes("Cloud workspaces cannot be replaced or merged through import")) throw new Error('Cloud retention lifecycle must archive cards and block parent hard deletion paths.');
const cloudSources = [firebaseAdapter, cloudAdapter, cloudSync, main].join('\n');
if (/enableIndexedDbPersistence|persistentLocalCache|persistentMultipleTabManager|CACHE_SIZE_UNLIMITED/.test(cloudSources)) throw new Error('Persistent Firestore caching is approval-gated and must remain disabled.');
console.log(`Static validation passed: ${required.length} semantic/runtime guards plus adapter-boundary checks.`);
