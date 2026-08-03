import {deleteDoc, doc, getFirestore} from 'firebase/firestore';

export async function probeHardDeleteAuthorization(app, auth, {workspaceId, boardId, cardId}) {
  if (!auth.currentUser) throw Object.assign(new Error('Sign in before testing authorization.'), {code:'AUTH_REQUIRED'});
  const db = getFirestore(app), paths = [
    ['workspace', 'workspaces'], ['board', 'workspaces', workspaceId, 'boards'],
    ['list', 'workspaces', workspaceId, 'boards', boardId, 'lists'],
    ['card', 'workspaces', workspaceId, 'boards', boardId, 'cards'],
    ['comment', 'workspaces', workspaceId, 'boards', boardId, 'cards', cardId, 'comments'],
    ['invite', 'workspaces', workspaceId, 'invites'], ['activity', 'workspaces', workspaceId, 'activity']
  ], result = {};
  for (const [name, ...path] of paths) {
    try { await deleteDoc(doc(db, ...path, crypto.randomUUID())); result[name] = 'allowed'; }
    catch (error) { result[name] = String(error?.code || 'unknown'); }
  }
  return Object.freeze(result);
}
