import '../state-core.js';
import {createLocalWorkspaceAdapter} from './adapters/local-workspace-adapter.js';
import {createUnavailableCloudAdapter, CloudNotConfiguredError} from './adapters/adapter-contract.js';
import {cloudConfig, cloudConfigured, cloudStatus} from './config.js';

const State = globalThis.FlowboardState;
if (!State) throw new Error('Flowboard state domain failed to initialize.');

let cloudAdapter = createUnavailableCloudAdapter();
let cloudInitializationError = null;
const localAdapter = createLocalWorkspaceAdapter({
  validWorkspace: State.validWorkspace,
  normalizeWorkspace: State.normalizeWorkspace,
  migrateLegacy: State.migrateLegacy,
  makeWorkspace: State.makeWorkspace,
  clone: State.clone
});
if (cloudConfigured) {
  try {
    const {createFirebaseWorkspaceAdapter} = await import('./adapters/firebase-workspace-adapter.js');
    cloudAdapter = createFirebaseWorkspaceAdapter(cloudConfig);
  } catch (error) {
    cloudInitializationError = error;
    console.error('Flowboard could not initialize Firebase Authentication.', error);
  }
}

globalThis.FlowboardRuntime = Object.freeze({
  cloudConfig,
  cloudConfigured,
  cloudStatus,
  cloudInitializationError,
  localAdapter,
  cloudAdapter,
  CloudNotConfiguredError
});

await import('../app.js');

if (cloudConfigured && !cloudInitializationError) {
  const [{initializeAuthUI}, {initializeCloudWorkspaceUI}, {initializeInviteUI}, {initializeMembersUI}, {initializeCloudSyncController}, {initializeActivityUI}, {initializeAssignmentUI}, {initializeCommentsUI}] = await Promise.all([
    import('./auth-ui.js'), import('./cloud-workspace-ui.js'), import('./invite-ui.js'), import('./members-ui.js'), import('./cloud-sync-controller.js'), import('./activity-ui.js'), import('./assignment-ui.js'), import('./comments-ui.js')
  ]);
  const cloudUI = initializeCloudWorkspaceUI({localAdapter, cloudAdapter});
  const inviteUI = initializeInviteUI(cloudAdapter);
  const membersUI = initializeMembersUI(cloudAdapter);
  const syncController = initializeCloudSyncController(cloudAdapter);
  const activityUI = initializeActivityUI(cloudAdapter);
  const assignmentUI = initializeAssignmentUI(cloudAdapter);
  const commentsUI = initializeCommentsUI(cloudAdapter);
  initializeAuthUI(cloudAdapter, {onSessionChange:session => { syncController.setSession(session); cloudUI.setSession(session); inviteUI.setSession(session); membersUI.setSession(session); activityUI.setSession(session); assignmentUI.setSession(session); commentsUI.setSession(session); }});
} else if (cloudConfigured) {
  const accountButton = document.querySelector('#account-button');
  accountButton.disabled = true;
  accountButton.textContent = 'Unavailable';
  document.querySelector('#cloud-status').textContent = 'Firebase unavailable';
}
