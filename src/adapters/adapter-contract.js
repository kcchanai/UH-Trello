/**
 * Flowboard workspace adapter contract.
 *
 * Adapters isolate the UI/domain layer from where an optional workspace lives.
 * The local adapter is the only functional adapter in Phase A. Remote methods
 * intentionally reject until a configured, server-authorized implementation is
 * introduced in later phases.
 */

export const REMOTE_METHODS = Object.freeze([
  'getSession', 'onAuthStateChange', 'signInWithGoogle', 'signOut', 'verifyWorkspaceAccess',
  'listWorkspaces', 'fetchWorkspace', 'renameWorkspace', 'archiveWorkspace', 'restoreWorkspace', 'migrateWorkspaceToGranular', 'subscribeWorkspace', 'subscribeComments', 'listOlderComments',
  'createComment', 'updateComment', 'removeComment', 'probeCommentQueryAuthorization', 'probeHardDeleteAuthorization',
  'createWorkspace', 'applyMutation', 'applyWorkspaceMutation', 'inviteMember', 'createInvite', 'listMembers', 'listInvites', 'revokeInvite', 'acceptInvite',
  'changeMemberRole', 'removeMember', 'leaveWorkspace', 'transferOwnership', 'uploadLocalWorkspace',
  'exportRemoteWorkspace'
]);

export class CloudNotConfiguredError extends Error {
  constructor() {
    super('Cloud workspaces are not configured. Flowboard is operating locally in this browser.');
    this.name = 'CloudNotConfiguredError';
    this.code = 'CLOUD_NOT_CONFIGURED';
  }
}

/**
 * A deliberately non-functional cloud boundary. This is not fake sign-in or
 * fake synchronization: every remote method rejects clearly until Phase B+.
 */
export function createUnavailableCloudAdapter() {
  const unavailable = async () => { throw new CloudNotConfiguredError(); };
  return Object.freeze(Object.fromEntries(REMOTE_METHODS.map(method => [method, unavailable])));
}
