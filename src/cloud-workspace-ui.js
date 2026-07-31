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
      document.querySelector('#cloud-status').textContent = 'Cloud copy created · local active';
    } catch (error) {
      console.error('Flowboard cloud migration failed.', error); announce(messageFor(error));
      create.disabled = false; backup.disabled = false; name.disabled = false;
    }
  });

  return {
    setSession(next) {
      session = next;
      if (!session && dialog.open) dialog.close();
      open.hidden = !session;
    }
  };
}
