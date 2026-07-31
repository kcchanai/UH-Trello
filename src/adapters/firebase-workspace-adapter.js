import {getApp, getApps, initializeApp} from 'firebase/app';
import {
  browserLocalPersistence, getAuth, GoogleAuthProvider, onAuthStateChanged,
  setPersistence, signInWithPopup, signOut as firebaseSignOut
} from 'firebase/auth';
import {REMOTE_METHODS} from './adapter-contract.js';

export class CloudFeatureUnavailableError extends Error {
  constructor(feature) {
    super(`${feature} is not available yet. Your local workspace has not been uploaded or changed.`);
    this.name = 'CloudFeatureUnavailableError';
    this.code = 'CLOUD_FEATURE_UNAVAILABLE';
  }
}

const sessionFor = user => user ? Object.freeze({
  uid:user.uid, displayName:user.displayName || '', email:user.email || '',
  emailVerified:Boolean(user.emailVerified), photoURL:user.photoURL || ''
}) : null;

export function createFirebaseWorkspaceAdapter(config) {
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const persistenceReady = setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  let workspaceModule;
  const cloud = () => workspaceModule ||= import('./firebase-cloud-workspace.js');

  const adapter = {
    async getSession() { await persistenceReady; return sessionFor(auth.currentUser); },
    onAuthStateChange(callback) { return onAuthStateChanged(auth, user => callback(sessionFor(user))); },
    async signInWithGoogle() { await persistenceReady; return sessionFor((await signInWithPopup(auth, provider)).user); },
    async signOut() { await firebaseSignOut(auth); },
    async listWorkspaces() { return (await cloud()).listCloudWorkspaces(app, auth); },
    async fetchWorkspace(workspaceId) { return (await cloud()).fetchCloudWorkspace(app, auth, workspaceId); },
    async uploadLocalWorkspace(options) { return (await cloud()).uploadLocalWorkspace(app, auth, options); }
  };

  for (const method of REMOTE_METHODS) if (!(method in adapter)) adapter[method] = async () => { throw new CloudFeatureUnavailableError(method); };
  return Object.freeze(adapter);
}
