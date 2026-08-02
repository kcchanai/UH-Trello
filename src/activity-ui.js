const actions = Object.freeze({
  'board-created':'created a board', 'board-updated':'updated a board',
  'card-created':'created a card', 'card-updated':'updated a card', 'card-moved':'moved a card', 'card-assigned':'updated card assignments',
  'list-created':'created a list', 'list-updated':'updated a list', 'workspace-updated':'updated the workspace'
});

const formatTime = value => {
  const date = value?.toDate?.();
  return date instanceof Date && !Number.isNaN(date.valueOf()) ? date.toLocaleString() : 'Time unavailable';
};

export function initializeActivityUI(cloudAdapter) {
  const open = document.querySelector('#view-cloud-activity');
  const dialog = document.querySelector('#cloud-activity-dialog');
  const close = document.querySelector('#close-cloud-activity');
  const status = document.querySelector('#cloud-activity-status');
  const list = document.querySelector('#cloud-activity-list');
  const more = document.querySelector('#load-more-cloud-activity');
  let session = null, workspace = null, cursor = null, loading = false;

  const load = async reset => {
    if (!session || !workspace || loading) return;
    loading = true; more.disabled = true; status.textContent = reset ? 'Loading authenticated activity…' : 'Loading more activity…';
    if (reset) { cursor = null; list.replaceChildren(); }
    try {
      const page = await cloudAdapter.listActivity(workspace.id, {cursor, pageSize:25});
      page.entries.forEach(entry => {
        const item = document.createElement('li'), text = document.createElement('span'), time = document.createElement('time');
        text.textContent = `${entry.actorUid === session.uid ? 'You' : 'A workspace member'} ${actions[entry.action] || 'updated the workspace'}.`;
        time.textContent = formatTime(entry.createdAt); time.dateTime = entry.createdAt?.toDate?.().toISOString?.() || '';
        item.append(text, time); list.append(item);
      });
      cursor = page.cursor;
      more.hidden = !page.hasMore;
      status.textContent = list.children.length ? `Showing ${list.children.length} authenticated event${list.children.length === 1 ? '' : 's'}, newest first.` : 'No authenticated workspace activity has been recorded yet.';
    } catch (error) {
      console.error('Flowboard could not load authenticated activity.', error);
      status.textContent = error?.code === 'permission-denied' ? 'Workspace access changed. Activity is no longer available.' : 'Authenticated activity could not be loaded.';
      more.hidden = true;
    } finally { loading = false; more.disabled = false; }
  };

  window.addEventListener('flowboard:cloud-selection', event => {
    workspace = event.detail || null; open.hidden = !session || !workspace;
    if (!workspace && dialog.open) dialog.close();
  });
  open.addEventListener('click', async () => { if (!workspace) return; dialog.showModal(); await load(true); close.focus(); });
  more.addEventListener('click', () => load(false));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
  dialog.addEventListener('close', () => open.focus());

  return {setSession(next) { session = next; if (!session) { workspace = null; open.hidden = true; if (dialog.open) dialog.close(); } }};
}
