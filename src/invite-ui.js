const inviteParameters = () => {
  const url = new URL(window.location.href), workspaceId = url.searchParams.get('workspace'), inviteId = url.searchParams.get('invite');
  return workspaceId && inviteId ? {workspaceId, inviteId} : null;
};

export function initializeInviteUI(adapter) {
  const invitation = inviteParameters();
  if (!invitation) return {setSession() {}};
  const dialog = document.querySelector('#invite-dialog');
  const close = document.querySelector('#close-invite-dialog');
  const status = document.querySelector('#invite-status');
  const signIn = document.querySelector('#invite-sign-in');
  const accept = document.querySelector('#accept-invite');
  let session = null;
  const render = () => {
    signIn.hidden = Boolean(session);
    if (!session) { status.textContent = 'Sign in with the invited Google account, then return to this invitation link.'; accept.hidden = true; }
    else { status.textContent = 'You are signed in. Continue to check this invitation with Firebase.'; accept.hidden = false; }
  };
  signIn.addEventListener('click', async () => {
    signIn.disabled = true; status.textContent = 'Opening Google sign-in…';
    try { session = await adapter.signInWithGoogle(); render(); }
    catch (error) { console.error('Flowboard invitation sign-in failed.', error); status.textContent = 'Google sign-in could not be completed. The invitation has not been accepted.'; }
    finally { signIn.disabled = false; }
  });
  dialog.showModal(); render();
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
  accept.addEventListener('click', async () => {
    if (!session) return;
    accept.disabled = true; status.textContent = 'Checking and accepting invitation…';
    try {
      await adapter.acceptInvite(invitation);
      status.textContent = 'Invitation accepted. This browser-local workspace was not changed.';
      accept.hidden = true;
      const url = new URL(window.location.href); url.searchParams.delete('workspace'); url.searchParams.delete('invite'); history.replaceState({}, '', url);
    } catch (error) {
      console.error('Flowboard invitation acceptance failed.', error);
      status.textContent = 'This invitation is unavailable for this account. Use the invited verified Google account, or ask the owner for a new link.';
    } finally { accept.disabled = false; }
  });
  return {setSession(next) { session = next; render(); }};
}
