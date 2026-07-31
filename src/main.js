import '../state-core.js';
import {createLocalWorkspaceAdapter} from './adapters/local-workspace-adapter.js';
import {createUnavailableCloudAdapter, CloudNotConfiguredError} from './adapters/adapter-contract.js';
import {cloudConfig, cloudConfigured, cloudStatus} from './config.js';

const State = globalThis.FlowboardState;

if (!State) throw new Error('Flowboard state domain failed to initialize.');

globalThis.FlowboardRuntime = Object.freeze({
  cloudConfig,
  cloudConfigured,
  cloudStatus,
  localAdapter: createLocalWorkspaceAdapter({
    validWorkspace: State.validWorkspace,
    normalizeWorkspace: State.normalizeWorkspace,
    migrateLegacy: State.migrateLegacy,
    makeWorkspace: State.makeWorkspace,
    clone: State.clone
  }),
  cloudAdapter: createUnavailableCloudAdapter(),
  CloudNotConfiguredError
});

await import('../app.js');
