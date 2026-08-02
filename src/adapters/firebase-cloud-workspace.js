import {granularizeBoard, rehydrateGranularWorkspace} from '../granular-workspace.js';
import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, startAfter, Timestamp, updateDoc, writeBatch
} from 'firebase/firestore';

const requireUser = auth => {
  if (!auth.currentUser) throw Object.assign(new Error('Sign in before using a cloud workspace.'), {code:'AUTH_REQUIRED'});
  return auth.currentUser;
};
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const randomId = () => {
  const values = new Uint8Array(16); crypto.getRandomValues(values);
  return btoa(String.fromCharCode(...values)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export async function listCloudWorkspaces(app, auth) {
  const db = getFirestore(app), user = requireUser(auth);
  const userSnapshot = await getDoc(doc(db, 'users', user.uid));
  const ids = [...new Set(userSnapshot.data()?.workspaceIds || [])].filter(id => typeof id === 'string' && id).slice(0, 100);
  const results = await Promise.allSettled(ids.map(async id => {
    const [workspace, membership] = await Promise.all([
      getDoc(doc(db, 'workspaces', id)), getDoc(doc(db, 'workspaces', id, 'members', user.uid))
    ]);
    return workspace.exists() && membership.exists() ? {id:workspace.id, ...workspace.data(), role:membership.data().role} : null;
  }));
  return results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
}

export async function fetchCloudWorkspace(app, auth, workspaceId) {
  const db = getFirestore(app); requireUser(auth);
  const metadata = await getDoc(doc(db, 'workspaces', workspaceId));
  if (!metadata.exists()) throw Object.assign(new Error('Cloud workspace was not found.'), {code:'WORKSPACE_NOT_FOUND'});
  const boards = await getDocs(query(collection(db, 'workspaces', workspaceId, 'boards'), orderBy('rank')));
  const workspace = {...metadata.data(), id:workspaceId};
  if (workspace.migration?.state !== 'verified') return {...workspace, boards:boards.docs.map(item => item.data().snapshot)};
  const records = await Promise.all(boards.docs.map(async item => ({
    board:{id:item.id, ...item.data()},
    lists:(await getDocs(query(collection(item.ref, 'lists'), orderBy('rank')))).docs.map(doc => ({id:doc.id, ...doc.data()})),
    cards:(await getDocs(query(collection(item.ref, 'cards'), orderBy('rank')))).docs.map(doc => ({id:doc.id, ...doc.data()}))
  })));
  return rehydrateGranularWorkspace(workspace, records);
}

export async function listWorkspaceActivity(app, auth, workspaceId, {cursor = null, pageSize = 25} = {}) {
  const db = getFirestore(app); requireUser(auth);
  const safeSize = Math.min(Math.max(Number.isInteger(pageSize) ? pageSize : 25, 1), 25);
  const constraints = [orderBy('createdAt', 'desc'), limit(safeSize)];
  if (cursor) constraints.splice(1, 0, startAfter(cursor));
  const snapshot = await getDocs(query(collection(db, 'workspaces', workspaceId, 'activity'), ...constraints));
  return {entries:snapshot.docs.map(item => ({id:item.id, ...item.data()})), cursor:snapshot.docs.at(-1) || null, hasMore:snapshot.size === safeSize};
}

export function subscribeCloudWorkspace(app, auth, {workspaceId, boardId, onBoard, onMembership, onStatus, onError}) {
  const db = getFirestore(app), user = requireUser(auth), snapshots = {board:null, lists:null, cards:null};
  let stopped = false, unsubscribers = [];
  const stop = () => { if (stopped) return; stopped = true; unsubscribers.splice(0).forEach(unsubscribe => unsubscribe()); };
  const fail = error => { if (stopped) return; stop(); onError?.(error); };
  const metadataStatus = metadata => onStatus?.(metadata.hasPendingWrites ? 'saving' : metadata.fromCache ? 'offline' : 'synced');
  const emitBoard = () => {
    if (stopped || !snapshots.board || !snapshots.lists || !snapshots.cards) return;
    if (!snapshots.board.exists()) return fail(Object.assign(new Error('The active cloud board is no longer available.'), {code:'BOARD_NOT_FOUND'}));
    const board = {id:snapshots.board.id, ...snapshots.board.data()};
    const lists = snapshots.lists.docs.map(item => ({id:item.id, ...item.data()}));
    const cards = snapshots.cards.docs.map(item => ({id:item.id, ...item.data()}));
    onBoard?.({board, lists, cards});
    metadataStatus([snapshots.board, snapshots.lists, snapshots.cards].some(item => item.metadata.hasPendingWrites) ? {hasPendingWrites:true, fromCache:false} : {hasPendingWrites:false, fromCache:[snapshots.board, snapshots.lists, snapshots.cards].some(item => item.metadata.fromCache)});
  };
  const options = {includeMetadataChanges:true};
  const watch = (reference, next) => onSnapshot(reference, options, next, fail);
  unsubscribers = [
    watch(doc(db, 'workspaces', workspaceId), snapshot => { if (!snapshot.exists()) return fail(Object.assign(new Error('Workspace access was removed.'), {code:'ACCESS_REMOVED'})); }),
    watch(doc(db, 'workspaces', workspaceId, 'members', user.uid), snapshot => { if (!snapshot.exists()) return fail(Object.assign(new Error('Workspace access was removed.'), {code:'ACCESS_REMOVED'})); onMembership?.(snapshot.data().role); }),
    watch(doc(db, 'workspaces', workspaceId, 'boards', boardId), snapshot => { snapshots.board = snapshot; emitBoard(); }),
    watch(query(collection(db, 'workspaces', workspaceId, 'boards', boardId, 'lists'), orderBy('rank')), snapshot => { snapshots.lists = snapshot; emitBoard(); }),
    watch(query(collection(db, 'workspaces', workspaceId, 'boards', boardId, 'cards'), orderBy('rank')), snapshot => { snapshots.cards = snapshot; emitBoard(); })
  ];
  return stop;
}

export async function migrateWorkspaceToGranular(app, auth, workspaceId) {
  const db = getFirestore(app), user = requireUser(auth), workspaceRef = doc(db, 'workspaces', workspaceId);
  const workspaceSnapshot = await getDoc(workspaceRef);
  if (!workspaceSnapshot.exists() || workspaceSnapshot.data().ownerUid !== user.uid) throw Object.assign(new Error('Only the workspace owner can migrate this cloud workspace.'), {code:'OWNER_REQUIRED'});
  if (workspaceSnapshot.data().migration?.state === 'verified') return {alreadyMigrated:true, ...workspaceSnapshot.data().migration.counts};
  const boards = await getDocs(query(collection(db, 'workspaces', workspaceId, 'boards'), orderBy('rank')));
  const granular = boards.docs.map((item, rank) => granularizeBoard(item.data().snapshot, rank));
  const counts = {boards:granular.length, lists:granular.reduce((n, item) => n + item.lists.length, 0), cards:granular.reduce((n, item) => n + item.cards.length, 0)};
  if (counts.boards > 100 || counts.lists > 1000 || counts.cards > 10000) throw Object.assign(new Error('This workspace is too large for the safe granular migration.'), {code:'WORKSPACE_TOO_LARGE'});
  await updateDoc(workspaceRef, {status:'migrating', migration:{version:1, state:'migrating', counts, startedAt:serverTimestamp()}, updatedAt:serverTimestamp()});
  const writes = [];
  granular.forEach(item => {
    const boardRef = doc(db, 'workspaces', workspaceId, 'boards', item.board.id);
    writes.push({ref:boardRef, data:{...item.board, granularVersion:1, revision:0, clientMutationId:randomId(), updatedAt:serverTimestamp()}, options:{merge:true}});
    item.lists.forEach(list => writes.push({ref:doc(boardRef, 'lists', list.id), data:{...list, granularVersion:1, revision:0, clientMutationId:randomId(), updatedAt:serverTimestamp()}, options:{merge:true}}));
    item.cards.forEach(card => writes.push({ref:doc(boardRef, 'cards', card.id), data:{...card, granularVersion:1, revision:0, clientMutationId:randomId(), updatedAt:serverTimestamp()}, options:{merge:true}}));
  });
  for (let index = 0; index < writes.length; index += 400) { const batch = writeBatch(db); writes.slice(index, index + 400).forEach(write => batch.set(write.ref, write.data, write.options)); await batch.commit(); }
  const verified = await Promise.all(boards.docs.map(async item => {
    const [lists, cards] = await Promise.all([getDocs(collection(item.ref, 'lists')), getDocs(collection(item.ref, 'cards'))]);
    const expected = granular.find(entry => entry.board.id === item.id);
    return lists.size === expected.lists.length && cards.size === expected.cards.length;
  }));
  if (!verified.every(Boolean)) throw Object.assign(new Error('Granular cloud migration could not be verified. The legacy snapshots were preserved.'), {code:'MIGRATION_VERIFICATION_FAILED'});
  await updateDoc(workspaceRef, {status:'ready', migration:{version:1, state:'verified', counts, verifiedAt:serverTimestamp()}, updatedAt:serverTimestamp()});
  return {alreadyMigrated:false, ...counts};
}

export async function applyCloudMutation(app, auth, {workspaceId, boardId, entity, entityId, revision, clientMutationId, patch}) {
  const db = getFirestore(app); requireUser(auth);
  if (!['boards', 'lists', 'cards'].includes(entity) || !/^[A-Za-z0-9_-]{16,128}$/.test(clientMutationId || '') || !Number.isInteger(revision) || revision < 0 || !patch || typeof patch !== 'object') throw Object.assign(new Error('The cloud edit request is invalid.'), {code:'INVALID_MUTATION'});
  const ref = entity === 'boards' ? doc(db, 'workspaces', workspaceId, 'boards', entityId) : doc(db, 'workspaces', workspaceId, 'boards', boardId, entity, entityId);
  await runTransaction(db, async transaction => {
    const current = await transaction.get(ref);
    if (!current.exists()) throw Object.assign(new Error('The cloud item no longer exists.'), {code:'MUTATION_TARGET_MISSING'});
    const data = current.data();
    if ((data.revision ?? 0) !== revision) throw Object.assign(new Error('This cloud item changed elsewhere. Reload before retrying.'), {code:'REVISION_CONFLICT'});
    transaction.update(ref, {...patch, revision:revision + 1, clientMutationId, updatedAt:serverTimestamp()});
  });
}

const comparable = value => JSON.stringify(value, (key, item) => ['revision', 'clientMutationId', 'updatedAt'].includes(key) ? undefined : item);
const granularDocuments = workspace => {
  const documents = new Map();
  (workspace.boards || []).forEach((snapshot, boardRank) => {
    const board = granularizeBoard(snapshot, boardRank);
    documents.set(`boards/${board.board.id}`, {data:board.board});
    board.lists.forEach(list => documents.set(`boards/${board.board.id}/lists/${list.id}`, {data:list}));
    board.cards.forEach(card => documents.set(`boards/${board.board.id}/cards/${card.id}`, {data:card}));
  });
  return documents;
};

export async function applyCloudWorkspaceMutation(app, auth, {workspaceId, before, next, clientMutationId, activityAction = null}) {
  const db = getFirestore(app), user = requireUser(auth);
  const allowedActivityActions = ['board-created','board-updated','card-created','card-updated','card-moved','list-created','list-updated','workspace-updated'];
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(clientMutationId || '') || !before || !next) throw Object.assign(new Error('The cloud edit request is invalid.'), {code:'INVALID_MUTATION'});
  const previous = granularDocuments(before), desired = granularDocuments(next);
  const paths = [...new Set([...previous.keys(), ...desired.keys()])].filter(path => comparable(previous.get(path)?.data) !== comparable(desired.get(path)?.data));
  if (paths.length > 300) throw Object.assign(new Error('This edit changes too many cloud records. Make a smaller edit and try again.'), {code:'MUTATION_TOO_LARGE'});
  if (!paths.length) return fetchCloudWorkspace(app, auth, workspaceId);
  const activityPath = paths.find(path => path.includes('/cards/')) || paths.find(path => path.includes('/lists/')) || paths[0];
  const activityPrior = previous.get(activityPath), activityTarget = desired.get(activityPath);
  if (!activityAction) {
    if (activityPath.includes('/cards/')) activityAction = !activityPrior && activityTarget ? 'card-created' : activityPrior && activityTarget && activityPrior.data.listId !== activityTarget.data.listId ? 'card-moved' : 'card-updated';
    else if (activityPath.includes('/lists/')) activityAction = !activityPrior && activityTarget ? 'list-created' : 'list-updated';
    else if (activityPath.startsWith('boards/')) activityAction = !activityPrior && activityTarget ? 'board-created' : 'board-updated';
    else activityAction = 'workspace-updated';
  }
  if (!allowedActivityActions.includes(activityAction)) throw Object.assign(new Error('The cloud activity request is invalid.'), {code:'INVALID_MUTATION'});
  const activityRef = doc(db, 'workspaces', workspaceId, 'activity', clientMutationId);
  await runTransaction(db, async transaction => {
    const priorActivity = await transaction.get(activityRef);
    if (priorActivity.exists() && priorActivity.data().clientMutationId !== clientMutationId) throw Object.assign(new Error('The activity identifier is unavailable.'), {code:'ACTIVITY_IDENTIFIER_CONFLICT'});
    for (const path of paths) {
      const prior = previous.get(path), target = desired.get(path), ref = doc(db, 'workspaces', workspaceId, ...path.split('/'));
      const current = await transaction.get(ref), expectedRevision = prior?.data.revision ?? 0;
      if (target && current.exists() && current.data().clientMutationId === clientMutationId && (current.data().revision ?? 0) === expectedRevision + 1) continue;
      if (!current.exists() && prior) throw Object.assign(new Error('This cloud item no longer exists.'), {code:'REVISION_CONFLICT'});
      if (current.exists() && (current.data().revision ?? 0) !== expectedRevision) throw Object.assign(new Error('This cloud workspace changed elsewhere. Reload before retrying.'), {code:'REVISION_CONFLICT'});
      if (!target) transaction.delete(ref);
      else {
        const data = {...target.data};
        delete data.revision; delete data.clientMutationId; delete data.updatedAt;
        if (current.exists()) { delete data.createdAt; transaction.update(ref, {...data, revision:expectedRevision + 1, clientMutationId, updatedAt:serverTimestamp()}); }
        else transaction.set(ref, {...data, revision:0, clientMutationId, updatedAt:serverTimestamp()});
      }
    }
    if (!priorActivity.exists()) transaction.set(activityRef, {actorUid:user.uid, action:activityAction, boardId:next.activeBoardId || '', clientMutationId, createdAt:serverTimestamp()});
  });
  return fetchCloudWorkspace(app, auth, workspaceId);
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
    title:board.title || 'Untitled board', rank, snapshot:board, revision:0, clientMutationId:randomId(), updatedAt:serverTimestamp()
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

export async function listMembers(app, auth, workspaceId) {
  const db = getFirestore(app); requireUser(auth);
  const snapshots = await getDocs(collection(db, 'workspaces', workspaceId, 'members'));
  return snapshots.docs.map(item => ({id:item.id, ...item.data()}));
}

export async function listInvites(app, auth, workspaceId) {
  const db = getFirestore(app); requireUser(auth);
  const snapshots = await getDocs(collection(db, 'workspaces', workspaceId, 'invites'));
  return snapshots.docs.map(item => ({id:item.id, ...item.data()}));
}

export async function createInvite(app, auth, {workspaceId, email, role, baseUrl}) {
  const db = getFirestore(app), user = requireUser(auth), emailLower = normalizeEmail(email);
  if (!user.emailVerified) throw Object.assign(new Error('Verify your Google email before inviting a member.'), {code:'EMAIL_NOT_VERIFIED'});
  if (!/^\S+@\S+\.\S+$/.test(emailLower)) throw Object.assign(new Error('Enter a valid Google email address.'), {code:'INVALID_EMAIL'});
  if (!['editor', 'viewer'].includes(role)) throw Object.assign(new Error('Choose editor or viewer access.'), {code:'INVALID_ROLE'});
  const inviteId = randomId(), expiresAt = Timestamp.fromMillis(Date.now() + 7 * 86_400_000);
  await writeBatch(db).set(doc(db, 'workspaces', workspaceId, 'invites', inviteId), {
    emailLower, role, createdBy:user.uid, createdAt:serverTimestamp(), expiresAt, revokedAt:null, acceptedAt:null, acceptedBy:null
  }).commit();
  const url = new URL(baseUrl); url.searchParams.set('workspace', workspaceId); url.searchParams.set('invite', inviteId);
  return {inviteId, emailLower, role, expiresAt, url:url.toString()};
}

export async function revokeInvite(app, auth, workspaceId, inviteId) {
  const db = getFirestore(app); requireUser(auth);
  await updateDoc(doc(db, 'workspaces', workspaceId, 'invites', inviteId), {revokedAt:serverTimestamp()});
}

export async function acceptInvite(app, auth, {workspaceId, inviteId}) {
  const db = getFirestore(app), user = requireUser(auth);
  if (!user.emailVerified) throw Object.assign(new Error('Verify your Google email before accepting an invitation.'), {code:'EMAIL_NOT_VERIFIED'});
  const invite = await getDoc(doc(db, 'workspaces', workspaceId, 'invites', inviteId));
  if (!invite.exists()) throw Object.assign(new Error('This invitation is unavailable.'), {code:'INVITE_UNAVAILABLE'});
  const data = invite.data(), batch = writeBatch(db), emailLower = normalizeEmail(user.email);
  batch.set(doc(db, 'workspaces', workspaceId, 'members', user.uid), {uid:user.uid, role:data.role, emailLower, inviteId});
  batch.update(invite.ref, {acceptedAt:serverTimestamp(), acceptedBy:user.uid});
  batch.set(doc(db, 'users', user.uid), {uid:user.uid, emailLower, displayName:user.displayName || '', workspaceIds:arrayUnion(workspaceId), updatedAt:serverTimestamp()}, {merge:true});
  await batch.commit();
}

export async function changeMemberRole(app, auth, workspaceId, uid, role) {
  if (!['editor', 'viewer'].includes(role)) throw Object.assign(new Error('Only editor and viewer roles can be assigned here.'), {code:'INVALID_ROLE'});
  const db = getFirestore(app); requireUser(auth);
  await updateDoc(doc(db, 'workspaces', workspaceId, 'members', uid), {role});
}
export async function removeMember(app, auth, workspaceId, uid) { const db = getFirestore(app); requireUser(auth); await deleteDoc(doc(db, 'workspaces', workspaceId, 'members', uid)); }
export async function leaveWorkspace(app, auth, workspaceId) {
  const db = getFirestore(app), user = requireUser(auth), batch = writeBatch(db);
  batch.delete(doc(db, 'workspaces', workspaceId, 'members', user.uid));
  batch.set(doc(db, 'users', user.uid), {workspaceIds:arrayRemove(workspaceId), updatedAt:serverTimestamp()}, {merge:true});
  await batch.commit();
}
export async function transferOwnership(app, auth, {workspaceId, successorUid, formerOwnerRole = 'editor'}) {
  if (!['editor', 'viewer'].includes(formerOwnerRole)) throw Object.assign(new Error('Choose editor or viewer for the former owner.'), {code:'INVALID_ROLE'});
  const db = getFirestore(app), user = requireUser(auth), batch = writeBatch(db), workspace = doc(db, 'workspaces', workspaceId);
  batch.update(workspace, {ownerUid:successorUid, updatedAt:serverTimestamp()});
  batch.update(doc(db, 'workspaces', workspaceId, 'members', user.uid), {role:formerOwnerRole});
  batch.update(doc(db, 'workspaces', workspaceId, 'members', successorUid), {role:'owner'});
  await batch.commit();
}
