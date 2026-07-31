import {
  arrayUnion, collection, doc, getDoc, getDocs, getFirestore, orderBy, query,
  serverTimestamp, writeBatch
} from 'firebase/firestore';

const requireUser = auth => {
  if (!auth.currentUser) throw Object.assign(new Error('Sign in before using a cloud workspace.'), {code:'AUTH_REQUIRED'});
  return auth.currentUser;
};
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;

export async function listCloudWorkspaces(app, auth) {
  const db = getFirestore(app), user = requireUser(auth);
  const userSnapshot = await getDoc(doc(db, 'users', user.uid));
  const ids = [...new Set(userSnapshot.data()?.workspaceIds || [])].filter(id => typeof id === 'string' && id).slice(0, 100);
  const results = await Promise.allSettled(ids.map(id => getDoc(doc(db, 'workspaces', id))));
  return results.flatMap((result, index) => result.status === 'fulfilled' && result.value.exists()
    ? [{id:result.value.id, ...result.value.data()}]
    : []);
}

export async function fetchCloudWorkspace(app, auth, workspaceId) {
  const db = getFirestore(app); requireUser(auth);
  const metadata = await getDoc(doc(db, 'workspaces', workspaceId));
  if (!metadata.exists()) throw Object.assign(new Error('Cloud workspace was not found.'), {code:'WORKSPACE_NOT_FOUND'});
  const boards = await getDocs(query(collection(db, 'workspaces', workspaceId, 'boards'), orderBy('rank')));
  return {...metadata.data(), id:workspaceId, boards:boards.docs.map(item => item.data().snapshot)};
}

export async function uploadLocalWorkspace(app, auth, {name, workspace}) {
  const db = getFirestore(app), user = requireUser(auth);
  if (!user.emailVerified) throw Object.assign(new Error('Verify your Google email before creating a cloud workspace.'), {code:'EMAIL_NOT_VERIFIED'});
  if (!workspace || !Array.isArray(workspace.boards) || !workspace.boards.length) throw Object.assign(new Error('The local workspace has no boards to upload.'), {code:'INVALID_WORKSPACE'});
  if (workspace.boards.length > 450) throw Object.assign(new Error('This workspace has too many boards for one safe migration.'), {code:'WORKSPACE_TOO_LARGE'});
  const cloudBoards = JSON.parse(JSON.stringify(workspace.boards)), boardIds = new Set();
  for (const board of cloudBoards) {
    if (typeof board.id !== 'string' || !board.id || board.id.includes('/') || board.id.length > 500 || boardIds.has(board.id)) {
      throw Object.assign(new Error('A board has an invalid or duplicate identifier.'), {code:'INVALID_WORKSPACE'});
    }
    boardIds.add(board.id);
    if (bytes(board) > 800_000) throw Object.assign(new Error(`“${board.title || 'Untitled board'}” is too large for a Firestore document.`), {code:'BOARD_TOO_LARGE'});
  }

  const workspaceId = crypto.randomUUID(), workspaceRef = doc(db, 'workspaces', workspaceId);
  const cleanName = String(name || 'My cloud workspace').trim().slice(0, 80) || 'My cloud workspace';
  const bootstrap = writeBatch(db);
  bootstrap.set(workspaceRef, {
    name:cleanName, ownerUid:user.uid, schemaVersion:workspace.schemaVersion,
    activeBoardId:workspace.activeBoardId, status:'initializing', createdAt:serverTimestamp(), updatedAt:serverTimestamp()
  });
  bootstrap.set(doc(db, 'workspaces', workspaceId, 'members', user.uid), {
    uid:user.uid, role:'owner', emailLower:(user.email || '').toLowerCase(),
    displayName:user.displayName || '', joinedAt:serverTimestamp()
  });
  bootstrap.set(doc(db, 'users', user.uid), {
    uid:user.uid, emailLower:(user.email || '').toLowerCase(), displayName:user.displayName || '',
    workspaceIds:arrayUnion(workspaceId), updatedAt:serverTimestamp()
  }, {merge:true});
  await bootstrap.commit();

  const upload = writeBatch(db);
  cloudBoards.forEach((board, rank) => upload.set(doc(db, 'workspaces', workspaceId, 'boards', board.id), {
    title:board.title || 'Untitled board', rank, snapshot:board, updatedAt:serverTimestamp()
  }));
  upload.update(workspaceRef, {status:'ready', updatedAt:serverTimestamp()});
  await upload.commit();

  const [verifiedMetadata, verifiedBoards] = await Promise.all([
    getDoc(workspaceRef), getDocs(collection(db, 'workspaces', workspaceId, 'boards'))
  ]);
  const expectedIds = new Set(cloudBoards.map(board => board.id));
  const verified = verifiedMetadata.exists()
    && verifiedMetadata.data().status === 'ready'
    && verifiedBoards.size === cloudBoards.length
    && verifiedBoards.docs.every(item => expectedIds.has(item.id) && item.data().snapshot?.id === item.id);
  if (!verified) throw Object.assign(new Error('Cloud workspace verification failed.'), {code:'MIGRATION_VERIFICATION_FAILED', workspaceId});
  return {id:workspaceId, name:cleanName, boardCount:cloudBoards.length, status:'ready'};
}
