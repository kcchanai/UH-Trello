const ACCESS_CODES = new Set(['permission-denied', 'ACCESS_REMOVED', 'WORKSPACE_NOT_FOUND']);

export function initializeCloudSyncController(adapter) {
  let session = null, unsubscribe = null, generation = 0;
  const app = () => globalThis.FlowboardApp;
  const stop = () => { generation += 1; unsubscribe?.(); unsubscribe = null; };
  const status = (name, message = '') => app()?.setCloudSyncStatus(name, message);
  const accessRemoved = message => { stop(); app()?.handleCloudAccessRemoved(message || 'Cloud workspace access was removed. Your browser-local workspace was not affected.'); };

  async function start(verifyAccess = false) {
    stop();
    const mode = app()?.getMode();
    const boardId = app()?.getActiveBoardId();
    if (!session || !mode || !['cloud-preview', 'cloud'].includes(mode.kind) || !mode.id || !boardId) return;
    const current = generation;
    status(navigator.onLine ? 'Connecting' : 'Offline');
    try {
      if (verifyAccess) await adapter.verifyWorkspaceAccess(mode.id);
      if (current !== generation) return;
      const next = await adapter.subscribeWorkspace({
        workspaceId:mode.id,
        boardId,
        onBoard:payload => { if (current === generation) app()?.applyRemoteCloudBoard(payload); },
        onMembership:role => { if (current === generation) app()?.updateCloudRole(role); },
        onStatus:name => { if (current === generation) status(name === 'saving' ? 'Saving' : name === 'offline' ? 'Offline' : 'Synced'); },
        onError:error => {
          if (current !== generation) return;
          if (ACCESS_CODES.has(error?.code)) accessRemoved();
          else status(error?.code === 'unavailable' || !navigator.onLine ? 'Offline' : 'Error', 'Realtime updates stopped. Reopen the cloud workspace to retry.');
        }
      });
      if (current !== generation) next(); else unsubscribe = next;
    } catch (error) {
      if (current !== generation) return;
      if (ACCESS_CODES.has(error?.code)) accessRemoved();
      else status(error?.code === 'unavailable' || !navigator.onLine ? 'Offline' : 'Error', 'Realtime updates could not start.');
    }
  }

  window.addEventListener('flowboard:cloud-preview-change', () => start());
  window.addEventListener('flowboard:active-board-change', () => start());
  window.addEventListener('offline', () => status('Offline'));
  window.addEventListener('online', () => start(true));

  return Object.freeze({
    setSession(next) {
      session = next;
      if (!session) {
        stop();
        if (['cloud-preview', 'cloud'].includes(app()?.getMode()?.kind)) app()?.handleCloudAccessRemoved('Signed out. Your browser-local workspace is active and unchanged.');
      } else if (['cloud-preview', 'cloud'].includes(app()?.getMode()?.kind)) start();
    },
    stop
  });
}
