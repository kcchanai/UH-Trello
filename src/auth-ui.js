const initials = session => (session?.displayName || session?.email || 'Account')
  .trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'A';

function messageFor(error) {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Google sign-in was cancelled.';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the Google sign-in window. Allow popups for this site and try again.';
  if (code === 'auth/unauthorized-domain') return 'This site is not authorized for Google sign-in. Check Firebase authorized domains.';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is not enabled for this Firebase project.';
  if (code === 'auth/network-request-failed') return 'Google sign-in could not reach the network. Check your connection and try again.';
  return 'Google sign-in could not be completed. Your local workspace was not changed.';
}

export function initializeAuthUI(adapter, {onSessionChange = () => {}} = {}) {
  const button = document.querySelector('#account-button');
  const dialog = document.querySelector('#account-dialog');
  const close = document.querySelector('#close-account-dialog');
  const signIn = document.querySelector('#google-sign-in');
  const signOut = document.querySelector('#account-sign-out');
  const migrate = document.querySelector('#open-cloud-migration');
  const workspaces = document.querySelector('#open-cloud-workspaces');
  const name = document.querySelector('#account-name');
  const email = document.querySelector('#account-email');
  const status = document.querySelector('#account-status');
  const cloudStatus = document.querySelector('#cloud-status');
  const announcer = document.querySelector('#announcer');
  let currentSession = null;

  const announce = text => {
    status.textContent = text;
    announcer.textContent = '';
    requestAnimationFrame(() => { announcer.textContent = text; });
  };
  const render = session => {
    currentSession = session;
    const signedIn = Boolean(session);
    button.textContent = signedIn ? initials(session) : 'Sign in';
    button.classList.toggle('signed-out', !signedIn);
    button.setAttribute('aria-label', signedIn ? `Account: ${session.displayName || session.email}` : 'Sign in with Google');
    name.textContent = signedIn ? (session.displayName || 'Google account') : 'Not signed in';
    email.textContent = signedIn ? session.email : 'Your local workspace remains available without an account.';
    signIn.hidden = signedIn;
    signOut.hidden = !signedIn;
    migrate.hidden = !signedIn;
    workspaces.hidden = !signedIn;
    cloudStatus.textContent = signedIn ? `Signed in · local workspace` : 'Google sign-in available';
    cloudStatus.title = signedIn
      ? 'Signed in with Google. This browser-local workspace has not been uploaded or synchronized.'
      : 'Firebase is configured. Sign-in does not upload your local workspace.';
    onSessionChange(session);
  };

  button.addEventListener('click', () => { render(currentSession); dialog.showModal(); (currentSession ? signOut : signIn).focus(); });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
  dialog.addEventListener('close', () => button.focus());
  signIn.addEventListener('click', async () => {
    signIn.disabled = true;
    announce('Opening Google sign-in…');
    try { render(await adapter.signInWithGoogle()); announce('Signed in with Google. Your local workspace was not uploaded.'); }
    catch (error) { console.error('Flowboard Google sign-in failed.', error); announce(messageFor(error)); }
    finally { signIn.disabled = false; }
  });
  signOut.addEventListener('click', async () => {
    signOut.disabled = true;
    try { await adapter.signOut(); announce('Signed out. Your local workspace remains in this browser.'); }
    catch (error) { console.error('Flowboard sign-out failed.', error); announce('Sign-out could not be completed. Try again.'); }
    finally { signOut.disabled = false; }
  });

  render(null);
  return adapter.onAuthStateChange(render);
}
