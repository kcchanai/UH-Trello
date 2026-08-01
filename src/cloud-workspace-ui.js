const countWorkspace = workspace => {
  const boards = workspace.boards || [];
  const lists = boards.reduce((sum, board) => sum + (board.lists?.length || 0), 0);
  const cards = boards.reduce((sum, board) => sum + (board.lists || []).reduce((n, list) => n + (list.cards?.length || 0), 0), 0);
  return {boards:boards.length, lists, cards, bytes:new TextEncoder().encode(JSON.stringify(workspace)).length};
};
const formatBytes = value => value < 1024 ? `${value} bytes` : `${(value / 1024).toFixed(1)} KB`;
const safeStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

function downloadJson(workspace) {
  const blob = new Blob([JSON.stringify(workspace, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `flowboard-before-cloud-${safeStamp()}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function messageFor(error) {
  if (error?.code === 'permission-denied') return 'Firebase denied the migration. Your local workspace was not changed.';
  if (error?.code === 'unavailable') return 'Firebase is temporarily unavailable. Your local workspace was not changed.';
  if (error?.code === 'EMAIL_NOT_VERIFIED') return error.message;
  if (error?.code === 'BOARD_TOO_LARGE' || error?.code === 'WORKSPACE_TOO_LARGE') return error.message;
  if (error?.code === 'MIGRATION_VERIFICATION_FAILED') return 'The cloud write could not be verified. A partial cloud copy may exist; your local workspace is unchanged.';
  return 'The cloud copy could not be created. Your local workspace was not changed.';
}

export function initializeCloudWorkspaceUI({localAdapter, cloudAdapter}) {
  const accountDialog = document.querySelector('#account-dialog');
  const open = document.querySelector('#open-cloud-migration');
  const dialog = document.querySelector('#cloud-migration-dialog');
  const close = document.querySelector('#close-cloud-migration');
  const name = document.querySelector('#cloud-workspace-name');
  const summary = document.querySelector('#cloud-migration-summary');
  const status = document.querySelector('#cloud-migration-status');
  const backup = document.querySelector('#download-migration-backup');
  const create = document.querySelector('#create-cloud-workspace');
  const workspaceButton = document.querySelector('#open-cloud-workspaces');
  const workspacesDialog = document.querySelector('#cloud-workspaces-dialog');
  const closeWorkspaces = document.querySelector('#close-cloud-workspaces');
  const workspacesList = document.querySelector('#cloud-workspaces-list');
  const workspacesStatus = document.querySelector('#cloud-workspaces-status');
  const returnLocal = document.querySelector('#return-to-local-workspace');
  const exportCloud = document.querySelector('#export-cloud-workspace');
  const announcer = document.querySelector('#announcer');
  let session = null, workspace = null, backupDownloaded = false, completed = false;

  const announce = text => { status.textContent = text; announcer.textContent = ''; requestAnimationFrame(() => { announcer.textContent = text; }); };
  const prepare = () => {
    workspace = localAdapter.exportLocalWorkspace(localAdapter.loadWorkspace().workspace);
    const counts = countWorkspace(workspace);
    summary.replaceChildren(...[
      ['Boards', counts.boards], ['Lists', counts.lists], ['Cards', counts.cards], ['JSON size', formatBytes(counts.bytes)]
    ].flatMap(([label, value]) => {
      const term = document.createElement('dt'), detail = document.createElement('dd');
      term.textContent = label; detail.textContent = String(value); return [term, detail];
    }));
    backupDownloaded = false; completed = false; create.disabled = true; create.textContent = '2. Create cloud workspace';
    backup.disabled = false; announce('Download a local backup before creating the cloud copy.');
  };

  open.addEventListener('click', () => {
    if (!session) return;
    prepare(); accountDialog.close(); dialog.showModal(); name.focus(); name.select();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
  dialog.addEventListener('close', () => open.focus());
  backup.addEventListener('click', () => {
    localAdapter.backupWorkspace(workspace); downloadJson(workspace); backupDownloaded = true;
    create.disabled = false; announce('Backup downloaded. Review the summary, then create the separate cloud workspace.');
  });
  create.addEventListener('click', async () => {
    if (!session || !backupDownloaded || completed) return;
    create.disabled = true; backup.disabled = true; name.disabled = true; announce('Creating and verifying the Firebase workspace…');
    try {
      const result = await cloudAdapter.uploadLocalWorkspace({name:name.value, workspace});
      completed = true; create.textContent = 'Cloud copy created';
      announce(`Cloud workspace “${result.name}” created and verified with ${result.boardCount} board${result.boardCount === 1 ? '' : 's'}. This browser is still using the local original.`);
      const cloudStatus = document.querySelector('#cloud-status');
      cloudStatus.textContent = 'Cloud copy · local';
      cloudStatus.title = 'Cloud workspace created and verified. The browser-local original remains active.';
      cloudStatus.setAttribute('aria-label', cloudStatus.title);
    } catch (error) {
      console.error('Flowboard cloud migration failed.', error); announce(messageFor(error));
      create.disabled = false; backup.disabled = false; name.disabled = false;
    }
  });

  workspaceButton.addEventListener('click', async () => {
    if (!session) return;
    accountDialog.close(); workspacesDialog.showModal(); workspacesList.replaceChildren();
    workspacesStatus.textContent = 'Loading cloud workspaces…';
    returnLocal.hidden = globalThis.FlowboardApp?.getMode().kind !== 'cloud-preview';
    exportCloud.hidden = returnLocal.hidden;
    try {
      const entries = await cloudAdapter.listWorkspaces();
      if (!entries.length) {
        if (globalThis.FlowboardApp?.getMode().kind === 'cloud-preview') globalThis.FlowboardApp.returnToLocal();
        returnLocal.hidden = true; exportCloud.hidden = true;
        workspacesStatus.textContent = 'No cloud workspaces are available to this account yet.';
        return;
      }
      workspacesStatus.textContent = 'Choose a workspace to open a read-only preview.';
      entries.forEach(entry => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'workspace-board';
        const title = document.createElement('strong'), detail = document.createElement('span');
        title.textContent = entry.name || 'Untitled cloud workspace';
        detail.textContent = entry.ownerUid === session.uid ? 'Owned cloud workspace · read-only preview' : 'Shared cloud workspace · read-only preview';
        button.append(title, detail);
        button.addEventListener('click', async () => {
          button.disabled = true; workspacesStatus.textContent = 'Opening read-only cloud preview…';
          try {
            const cloudWorkspace = await cloudAdapter.fetchWorkspace(entry.id);
            globalThis.FlowboardApp.openCloudPreview(cloudWorkspace, entry);
            returnLocal.hidden = false; exportCloud.hidden = false;
            workspacesStatus.textContent = `Viewing “${entry.name || 'Untitled cloud workspace'}” as a read-only preview. Local data is unchanged.`;
          } catch (error) {
            console.error('Flowboard could not open cloud workspace preview.', error);
            workspacesStatus.textContent = 'This cloud workspace could not be opened. Your local workspace is unchanged.';
          } finally { button.disabled = false; }
        });
        workspacesList.append(button);
      });
    } catch (error) {
      console.error('Flowboard could not list cloud workspaces.', error);
      workspacesStatus.textContent = 'Cloud workspaces could not be loaded. Your local workspace is unchanged.';
    }
  });
  closeWorkspaces.addEventListener('click', () => workspacesDialog.close());
  workspacesDialog.addEventListener('cancel', event => { event.preventDefault(); workspacesDialog.close(); });
  workspacesDialog.addEventListener('close', () => workspaceButton.focus());
  returnLocal.addEventListener('click', () => {
    globalThis.FlowboardApp.returnToLocal(); returnLocal.hidden = true; exportCloud.hidden = true;
    workspacesStatus.textContent = 'Returned to the browser-local workspace.';
  });
  exportCloud.addEventListener('click', () => {
    try { globalThis.FlowboardApp.exportCloudPreview(); workspacesStatus.textContent = 'Cloud preview JSON export downloaded.'; }
    catch (error) { workspacesStatus.textContent = 'Open a cloud preview before exporting it.'; }
  });

  window.addEventListener('flowboard:cloud-preview-change', () => {
    const preview = globalThis.FlowboardApp?.getMode().kind === 'cloud-preview';
    returnLocal.hidden = !preview; exportCloud.hidden = !preview;
    if (!preview && workspacesDialog.open) { workspacesList.replaceChildren(); workspacesStatus.textContent = 'Workspace access ended. Your browser-local workspace is active.'; }
  });

  return {
    setSession(next) {
      session = next;
      if (!session && dialog.open) dialog.close();
      open.hidden = !session;
    }
  };
}
