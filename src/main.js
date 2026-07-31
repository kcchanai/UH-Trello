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
  const [{initializeAuthUI}, {initializeCloudWorkspaceUI}, {initializeInviteUI}] = await Promise.all([
    import('./auth-ui.js'), import('./cloud-workspace-ui.js'), import('./invite-ui.js')
  ]);
  const cloudUI = initializeCloudWorkspaceUI({localAdapter, cloudAdapter});
  const inviteUI = initializeInviteUI(cloudAdapter);
  initializeAuthUI(cloudAdapter, {onSessionChange:session => { cloudUI.setSession(session); inviteUI.setSession(session); }});
} else if (cloudConfigured) {
  const accountButton = document.querySelector('#account-button');
  accountButton.disabled = true;
  accountButton.textContent = 'Unavailable';
  document.querySelector('#cloud-status').textContent = 'Firebase unavailable';
}
