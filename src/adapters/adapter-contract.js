/** Shared method list for configured and unavailable cloud adapters. */

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

/** Reject cloud operations clearly when Firebase is unavailable. */
export function createUnavailableCloudAdapter() {
  const unavailable = async () => { throw new CloudNotConfiguredError(); };
  return Object.freeze(Object.fromEntries(REMOTE_METHODS.map(method => [method, unavailable])));
}
