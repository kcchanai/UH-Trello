const ACCESS_CODES = new Set(['permission-denied', 'ACCESS_REMOVED', 'WORKSPACE_NOT_FOUND']);
const LOCAL_SAFE = ' Your browser-local workspace is active and unchanged.';
const isCloud = mode => ['cloud-preview', 'cloud'].includes(mode?.kind);

export function initializeCloudSyncController(adapter) {
  let session = null, unsubscribe = null, generation = 0;
  const app = () => globalThis.FlowboardApp;
  const stop = () => { generation += 1; unsubscribe?.(); unsubscribe = null; };
  const status = (name, message = '') => app()?.setCloudSyncStatus(name, message);
  const accessRemoved = message => { stop(); app()?.handleCloudAccessRemoved(`${message || 'Cloud workspace access was removed.'}${LOCAL_SAFE}`); };
  const reportError = (error, message) => ACCESS_CODES.has(error?.code)
    ? accessRemoved()
    : status(error?.code === 'unavailable' || !navigator.onLine ? 'Offline' : 'Error', message);

  async function start(verifyAccess = false) {
    stop();
    const mode = app()?.getMode();
    const boardId = app()?.getActiveBoardId();
    if (!session || !isCloud(mode) || !mode.id || !boardId) return;
    const current = generation, active = () => current === generation;
    status(navigator.onLine ? 'Connecting' : 'Offline');
    try {
      if (verifyAccess) await adapter.verifyWorkspaceAccess(mode.id);
      if (!active()) return;
      const next = await adapter.subscribeWorkspace({
        workspaceId:mode.id,
        boardId,
        onWorkspace:workspace => {
          if (!active()) return;
          if (workspace.status === 'archived') accessRemoved('This cloud workspace was archived.');
          else app()?.updateCloudWorkspaceName(mode.id, workspace.name);
        },
        onBoard:payload => { if (active()) app()?.applyRemoteCloudBoard(payload); },
        onMembership:role => { if (active()) app()?.updateCloudRole(role); },
        onStatus:name => { if (active()) status(name === 'saving' ? 'Saving' : name === 'offline' ? 'Offline' : 'Synced'); },
        onError:error => { if (active()) reportError(error, 'Realtime updates stopped. Reopen the cloud workspace to retry.'); }
      });
      if (!active()) next(); else unsubscribe = next;
    } catch (error) { if (active()) reportError(error, 'Realtime updates could not start.'); }
  }

  ['flowboard:cloud-preview-change', 'flowboard:active-board-change'].forEach(name => window.addEventListener(name, () => start()));
  window.addEventListener('offline', () => status('Offline'));
  window.addEventListener('online', () => start(true));

  return Object.freeze({
    setSession(next) {
      session = next;
      if (!session) isCloud(app()?.getMode()) ? accessRemoved('Signed out.') : stop();
      else if (isCloud(app()?.getMode())) start();
    },
    stop
  });
}
