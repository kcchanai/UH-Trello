import {readFile} from 'node:fs/promises';

const [html, app, core, main, localAdapter, firebaseAdapter, cloudAdapter, lifecycleAdapter, phaseHProbes, authUI, cloudUI, lifecycleUI, inviteUI, membersUI, cloudSync, activityUI, assignmentUI, commentsUI, rules] = await Promise.all([
  'index.html', 'app.js', 'state-core.js', 'src/main.js', 'src/adapters/local-workspace-adapter.js',
  'src/adapters/firebase-workspace-adapter.js', 'src/adapters/firebase-cloud-workspace.js', 'src/adapters/firebase-workspace-lifecycle.js', 'src/adapters/firebase-phase-h-probes.js',
  'src/auth-ui.js', 'src/cloud-workspace-ui.js', 'src/workspace-lifecycle-ui.js', 'src/invite-ui.js', 'src/members-ui.js', 'src/cloud-sync-controller.js', 'src/activity-ui.js', 'src/assignment-ui.js', 'src/comments-ui.js', 'firestore.rules'
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
if (!firebaseAdapter.includes('firebase-workspace-lifecycle.js') || !firebaseAdapter.includes('renameWorkspace') || !firebaseAdapter.includes('archiveWorkspace') || !firebaseAdapter.includes('restoreWorkspace') || !/status:["']archived["']/.test(lifecycleAdapter) || !lifecycleAdapter.includes('archivedByUid:') || !lifecycleAdapter.includes('runTransaction') || !lifecycleAdapter.includes('REVISION_CONFLICT')) throw new Error('Owner workspace lifecycle adapter is incomplete or not revision-safe.');
if (!cloudUI.includes('workspace-lifecycle-ui.js') || !lifecycleUI.includes('archived') || !lifecycleUI.includes('retained') || !lifecycleUI.includes('will be retained') || lifecycleUI.includes('confirm(')) throw new Error('Workspace lifecycle UI must disclose retention and use an in-app confirmation.');
if (!rules.includes('validWorkspaceOwnerUpdate') || !rules.includes('isActiveWorkspace(workspaceId)') || !rules.includes("request.resource.data.status == 'archived'") || !rules.includes('allow delete: if false;')) throw new Error('Workspace lifecycle Rules are incomplete or allow hard deletion.');
if (!cloudUI.includes('flowboard-before-cloud-') || !cloudUI.includes('still using the local original')) throw new Error('Cloud migration UI lacks backup-first local safety handling.');
if (!app.includes('openCloudPreview') || !app.includes("activeWorkspace.kind !== 'local'") || !cloudUI.includes('read-only cloud preview')) throw new Error('Cloud preview does not preserve the local-only boundary.');
if (!html.includes('workspace-members-dialog') || !inviteUI.includes('acceptInvite') || !membersUI.includes('transferOwnership')) throw new Error('Secure membership administration UI is incomplete.');
if (!firebaseAdapter.includes('subscribeWorkspace') || !firebaseAdapter.includes('verifyWorkspaceAccess') || !cloudAdapter.includes('onSnapshot') || !cloudSync.includes("window.addEventListener('offline'") || !cloudSync.includes('start(true)') || !cloudSync.includes('handleCloudAccessRemoved')) throw new Error('Realtime cloud lifecycle boundary is incomplete.');
if (!app.includes("$('#close-card-dialog').disabled = false")) throw new Error('Viewer card dialogs must retain a working visible close button.');
if (!html.includes('cloud-activity-dialog') || !activityUI.includes('listActivity') || !activityUI.includes('pageSize:25') || !activityUI.includes('text.textContent')) throw new Error('Authenticated activity feed is incomplete or unbounded.');
if (!html.includes('cloud-assignees-field') || !app.includes('assigneeUids') || !assignmentUI.includes('listMembers') || !assignmentUI.includes('checked.length>8') || !assignmentUI.includes('text.textContent')) throw new Error('Member-backed cloud assignment controls are incomplete or unsafe.');
if (!html.includes('cloud-comments-section') || !firebaseAdapter.includes('subscribeComments') || !cloudAdapter.includes("limit(safeSize)") || !commentsUI.includes('pageSize:25') || !commentsUI.includes('textContent') || !commentsUI.includes('MutationObserver') || !commentsUI.includes('member.emailLower')) throw new Error('Authenticated card comments are incomplete, unsafe, not active-card scoped, or missing active-member label fallback.');
if (!firebaseAdapter.includes('probeCommentQueryAuthorization') || !cloudAdapter.includes("limit(26)") || !cloudAdapter.includes("unbounded:await classify")) throw new Error('Phase H authenticated comment query-bound probe is incomplete.');
if (!firebaseAdapter.includes('firebase-phase-h-probes.js') || !phaseHProbes.includes("['workspace', 'workspaces']") || !phaseHProbes.includes('deleteDoc(doc(db, ...path, crypto.randomUUID()))')) throw new Error('Phase H random-ID hard-delete probe is incomplete or unsafe.');
const workspaceMutationStart = cloudAdapter.indexOf('export async function applyCloudWorkspaceMutation');
const workspaceMutationEnd = cloudAdapter.indexOf('\nexport async function uploadLocalWorkspace', workspaceMutationStart);
const workspaceMutation = cloudAdapter.slice(workspaceMutationStart, workspaceMutationEnd);
const readPhase = workspaceMutation.indexOf('await Promise.all(ops.map(item => transaction.get(item.ref)))');
const writePhase = workspaceMutation.indexOf('writes.forEach(write =>');
if (workspaceMutationStart < 0 || workspaceMutationEnd < 0 || readPhase < 0 || writePhase < 0 || readPhase > writePhase || workspaceMutation.slice(writePhase).includes('transaction.get(')) throw new Error('Workspace transactions must complete every document read before the write phase.');
if (!app.includes("Archive this cloud card?") || !app.includes("Cloud lists cannot be permanently deleted") || !app.includes("Cloud workspaces cannot be reset") || !app.includes("Cloud workspaces cannot be replaced or merged through import")) throw new Error('Cloud retention lifecycle must archive cards and block parent hard deletion paths.');
const cloudSources = [firebaseAdapter, cloudAdapter, lifecycleAdapter, cloudSync, main].join('\n');
if (/enableIndexedDbPersistence|persistentLocalCache|persistentMultipleTabManager|CACHE_SIZE_UNLIMITED/.test(cloudSources)) throw new Error('Persistent Firestore caching is approval-gated and must remain disabled.');
console.log(`Static validation passed: ${required.length} semantic/runtime guards plus adapter-boundary checks.`);
