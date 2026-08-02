import test, {after, before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';

const projectId = 'demo-flowboard-rules';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {rules: await readFile('firestore.rules', 'utf8')}
  });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const seed = async (workspaceId, ownerUid) => {
      await setDoc(doc(db, 'workspaces', workspaceId), {name:workspaceId, ownerUid, schemaVersion:1, status:'ready'});
      await setDoc(doc(db, 'workspaces', workspaceId, 'members', ownerUid), {
        uid:ownerUid, role:'owner', emailLower:`${ownerUid}@example.com`, displayName:ownerUid
      });
    };
    await seed('alpha', 'owner-a');
    await seed('beta', 'owner-b');
    await seed('transfer', 'owner-transfer');
    await setDoc(doc(db, 'workspaces', 'alpha', 'members', 'editor-a'), {
      uid:'editor-a', role:'editor', emailLower:'editor@example.com', displayName:'Editor A'
    });
    await setDoc(doc(db, 'workspaces', 'alpha', 'members', 'viewer-a'), {
      uid:'viewer-a', role:'viewer', emailLower:'viewer@example.com', displayName:'Viewer A'
    });
    await setDoc(doc(db, 'workspaces', 'transfer', 'members', 'successor'), {
      uid:'successor', role:'editor', emailLower:'successor@example.com', displayName:'Successor'
    });
    await setDoc(doc(db, 'users', 'viewer-a'), {uid:'viewer-a', emailLower:'viewer@example.com', workspaceIds:['alpha']});
    await setDoc(doc(db, 'workspaces', 'alpha', 'invites', 'invite-accept'), {
      emailLower:'invitee@example.com', role:'editor', createdBy:'owner-a',
      createdAt:Timestamp.fromMillis(Date.now() - 60_000), acceptedAt:null, acceptedBy:null, revokedAt:null,
      expiresAt:Timestamp.fromMillis(Date.now() + 3_600_000)
    });
    await setDoc(doc(db, 'workspaces', 'alpha', 'invites', 'invite-profile-required'), {
      emailLower:'profile-required@example.com', role:'editor', createdBy:'owner-a',
      createdAt:Timestamp.fromMillis(Date.now() - 60_000), acceptedAt:null, acceptedBy:null, revokedAt:null,
      expiresAt:Timestamp.fromMillis(Date.now() + 3_600_000)
    });
    await setDoc(doc(db, 'workspaces', 'alpha', 'invites', 'invite-revocable'), {
      emailLower:'revoked@example.com', role:'viewer', createdBy:'owner-a',
      createdAt:Timestamp.fromMillis(Date.now() - 60_000), acceptedAt:null, acceptedBy:null, revokedAt:null,
      expiresAt:Timestamp.fromMillis(Date.now() + 3_600_000)
    });
    await setDoc(doc(db, 'workspaces', 'alpha', 'invites', 'invite-expired'), {
      emailLower:'expired@example.com', role:'viewer', createdBy:'owner-a',
      createdAt:Timestamp.fromMillis(Date.now() - 8 * 86_400_000), acceptedAt:null, acceptedBy:null, revokedAt:null,
      expiresAt:Timestamp.fromMillis(Date.now() - 60_000)
    });
    await setDoc(doc(db, 'workspaces', 'alpha', 'invites', 'invite-incomplete'), {
      emailLower:'incomplete@example.com', role:'editor', createdBy:'owner-a',
      createdAt:Timestamp.fromMillis(Date.now() - 60_000), acceptedAt:null, acceptedBy:null, revokedAt:null,
      expiresAt:Timestamp.fromMillis(Date.now() + 3_600_000)
    });
    await setDoc(doc(db, 'workspaces', 'alpha', 'invites', 'invite-tamper'), {
      emailLower:'tamper@example.com', role:'editor', createdBy:'owner-a',
      createdAt:Timestamp.fromMillis(Date.now() - 60_000), acceptedAt:null, acceptedBy:null, revokedAt:null,
      expiresAt:Timestamp.fromMillis(Date.now() + 3_600_000)
    });
  });
});

after(async () => env?.cleanup());

const dbFor = (uid, email = `${uid}@example.com`, verified = true) =>
  env.authenticatedContext(uid, {email, email_verified:verified}).firestore();

const invitation = ({emailLower, role = 'viewer', expiresInDays = 6} = {}) => ({
  emailLower,
  role,
  createdBy:'owner-a',
  createdAt:serverTimestamp(),
  expiresAt:Timestamp.fromMillis(Date.now() + expiresInDays * 86_400_000),
  revokedAt:null,
  acceptedAt:null,
  acceptedBy:null
});

async function acceptInvite(db, workspaceId, inviteId, uid, email, role, includeProfile = true) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'workspaces', workspaceId, 'members', uid), {
    uid, role, emailLower:email, inviteId
  });
  batch.update(doc(db, 'workspaces', workspaceId, 'invites', inviteId), {
    acceptedAt:serverTimestamp(), acceptedBy:uid
  });
  if (includeProfile) batch.set(doc(db, 'users', uid), {uid, emailLower:email, workspaceIds:[workspaceId]}, {merge:true});
  return batch.commit();
}

test('anonymous and cross-workspace reads are denied', async () => {
  const anonymous = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonymous, 'workspaces', 'alpha')));
  await assertFails(getDoc(doc(dbFor('owner-b'), 'workspaces', 'alpha')));
  await assertSucceeds(getDoc(doc(dbFor('viewer-a'), 'workspaces', 'alpha')));
});

test('owner can add editor/viewer members, but viewer cannot escalate or write board content', async () => {
  await assertSucceeds(setDoc(doc(dbFor('owner-a'), 'workspaces', 'alpha', 'members', 'new-viewer'), {
    uid:'new-viewer', role:'viewer', emailLower:'new-viewer@example.com'
  }));
  await assertFails(setDoc(doc(dbFor('owner-a'), 'workspaces', 'alpha', 'members', 'bad-owner'), {
    uid:'bad-owner', role:'owner', emailLower:'bad-owner@example.com'
  }));
  await assertFails(setDoc(doc(dbFor('viewer-a'), 'workspaces', 'alpha', 'members', 'viewer-a'), {
    uid:'viewer-a', role:'owner', emailLower:'viewer@example.com'
  }, {merge:true}));
  await assertFails(setDoc(doc(dbFor('viewer-a'), 'workspaces', 'alpha', 'boards', 'blocked'), {title:'Blocked'}));
});

test('editor can write board content but cannot manage members', async () => {
  await assertSucceeds(setDoc(doc(dbFor('editor-a'), 'workspaces', 'alpha', 'boards', 'board-1'), {
    title:'Shared board', rank:'a0', revision:0, clientMutationId:'mutation-identifier-0000'
  }));
  await assertFails(setDoc(doc(dbFor('editor-a'), 'workspaces', 'alpha', 'members', 'intruder'), {
    uid:'intruder', role:'editor', emailLower:'intruder@example.com'
  }));
});

test('owner can write granular migration documents while a viewer cannot forge them', async () => {
  const owner = dbFor('owner-a');
  await assertSucceeds(setDoc(doc(owner, 'workspaces', 'alpha', 'boards', 'granular-board', 'lists', 'list-1'), {
    id:'list-1', title:'Migrated list', rank:0, granularVersion:1, revision:0, clientMutationId:'mutation-identifier-0001'
  }));
  await assertSucceeds(setDoc(doc(owner, 'workspaces', 'alpha', 'boards', 'granular-board', 'cards', 'card-1'), {
    id:'card-1', listId:'list-1', title:'Migrated card', rank:0, assigneeUids:[], granularVersion:1, revision:0, clientMutationId:'mutation-identifier-0002'
  }));
  await assertFails(setDoc(doc(dbFor('viewer-a'), 'workspaces', 'alpha', 'boards', 'granular-board', 'cards', 'forged'), {
    id:'forged', listId:'list-1', title:'Blocked', rank:1, assigneeUids:[], revision:0, clientMutationId:'mutation-identifier-0003'
  }));
});

test('cloud content updates require an incremented revision and client mutation identifier', async () => {
  const editor = dbFor('editor-a'), card = doc(editor, 'workspaces', 'alpha', 'boards', 'revision-board', 'cards', 'revision-card');
  await assertSucceeds(setDoc(card, {id:'revision-card', listId:'list-a', title:'Initial', rank:0, assigneeUids:[], revision:0, clientMutationId:'mutation-identifier-0004'}));
  await assertFails(updateDoc(card, {title:'No revision'}));
  await assertFails(updateDoc(card, {title:'Wrong revision', revision:2, clientMutationId:'mutation-identifier-0001'}));
  await assertFails(updateDoc(card, {title:'Short mutation id', revision:1, clientMutationId:'short'}));
  await assertSucceeds(updateDoc(card, {title:'Edited', revision:1, clientMutationId:'mutation-identifier-0001'}));
  await assertFails(updateDoc(doc(dbFor('viewer-a'), 'workspaces', 'alpha', 'boards', 'revision-board', 'cards', 'revision-card'), {title:'Viewer edit', revision:2, clientMutationId:'mutation-identifier-0002'}));
});

test('cloud assignments are bounded, unique, member-backed, and editor-controlled', async () => {
  const owner=dbFor('owner-a'), path=['workspaces','alpha','boards','assignment-board','cards'];
  await assertSucceeds(setDoc(doc(owner,...path,'assignment-card'), {id:'assignment-card', listId:'list-a', title:'Assigned', rank:0, assigneeUids:['editor-a','viewer-a'], revision:0, clientMutationId:'assignment-mutation-0001'}));
  await assertFails(setDoc(doc(owner,...path,'nonmember-card'), {id:'nonmember-card', listId:'list-a', title:'Forged', rank:1, assigneeUids:['not-a-member'], revision:0, clientMutationId:'assignment-mutation-0002'}));
  await assertFails(setDoc(doc(owner,...path,'duplicate-card'), {id:'duplicate-card', listId:'list-a', title:'Duplicate', rank:2, assigneeUids:['editor-a','editor-a'], revision:0, clientMutationId:'assignment-mutation-0003'}));
  await assertFails(updateDoc(doc(dbFor('viewer-a'),...path,'assignment-card'), {assigneeUids:[], revision:1, clientMutationId:'assignment-mutation-0004'}));
});

test('authenticated comments are actor-bound, activity-coupled, revisioned, and viewer read-only', async () => {
  const editor=dbFor('editor-a'), owner=dbFor('owner-a'), viewer=dbFor('viewer-a'), outsider=dbFor('owner-b');
  const commentPath=['workspaces','alpha','boards','revision-board','cards','revision-card','comments'];
  const activityPath=['workspaces','alpha','activity'];
  const createId='comment-mutation-0001', comment=doc(editor,...commentPath,createId), create=writeBatch(editor);
  create.set(comment,{authorUid:'editor-a',body:'First authenticated comment',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),deletedAt:null,revision:0,clientMutationId:createId});
  create.set(doc(editor,...activityPath,createId),{actorUid:'editor-a',action:'comment-created',boardId:'revision-board',clientMutationId:createId,createdAt:serverTimestamp()});
  await assertSucceeds(create.commit());
  await assertSucceeds(getDoc(doc(viewer,...commentPath,createId)));
  const commentCollection=collection(viewer,...commentPath);
  await assertSucceeds(getDocs(query(commentCollection,limit(25))));
  await assertFails(getDocs(query(commentCollection,limit(26))));
  await assertFails(getDoc(doc(outsider,...commentPath,createId)));

  const missingActivity='comment-mutation-0002';
  await assertFails(setDoc(doc(editor,...commentPath,missingActivity),{authorUid:'editor-a',body:'No activity',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),deletedAt:null,revision:0,clientMutationId:missingActivity}));
  const forgedId='comment-mutation-0003', forged=writeBatch(owner);
  forged.set(doc(owner,...commentPath,forgedId),{authorUid:'editor-a',body:'Forged author',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),deletedAt:null,revision:0,clientMutationId:forgedId});
  forged.set(doc(owner,...activityPath,forgedId),{actorUid:'owner-a',action:'comment-created',boardId:'revision-board',clientMutationId:forgedId,createdAt:serverTimestamp()});
  await assertFails(forged.commit());
  const viewerId='comment-mutation-0004', viewerWrite=writeBatch(viewer);
  viewerWrite.set(doc(viewer,...commentPath,viewerId),{authorUid:'viewer-a',body:'Viewer write',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),deletedAt:null,revision:0,clientMutationId:viewerId});
  viewerWrite.set(doc(viewer,...activityPath,viewerId),{actorUid:'viewer-a',action:'comment-created',boardId:'revision-board',clientMutationId:viewerId,createdAt:serverTimestamp()});
  await assertFails(viewerWrite.commit());
  const longId='comment-mutation-0005', oversized=writeBatch(editor);
  oversized.set(doc(editor,...commentPath,longId),{authorUid:'editor-a',body:'x'.repeat(2001),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),deletedAt:null,revision:0,clientMutationId:longId});
  oversized.set(doc(editor,...activityPath,longId),{actorUid:'editor-a',action:'comment-created',boardId:'revision-board',clientMutationId:longId,createdAt:serverTimestamp()});
  await assertFails(oversized.commit());

  const editId='comment-mutation-0006', edit=writeBatch(editor);
  edit.update(comment,{body:'Edited authenticated comment',updatedAt:serverTimestamp(),revision:1,clientMutationId:editId});
  edit.set(doc(editor,...activityPath,editId),{actorUid:'editor-a',action:'comment-updated',boardId:'revision-board',clientMutationId:editId,createdAt:serverTimestamp()});
  await assertSucceeds(edit.commit());
  const ownerEditId='comment-mutation-0007', ownerEdit=writeBatch(owner);
  ownerEdit.update(doc(owner,...commentPath,createId),{body:'Owner cannot edit another author',updatedAt:serverTimestamp(),revision:2,clientMutationId:ownerEditId});
  ownerEdit.set(doc(owner,...activityPath,ownerEditId),{actorUid:'owner-a',action:'comment-updated',boardId:'revision-board',clientMutationId:ownerEditId,createdAt:serverTimestamp()});
  await assertFails(ownerEdit.commit());

  const removeId='comment-mutation-0008', removal=writeBatch(owner);
  removal.update(doc(owner,...commentPath,createId),{body:'',deletedAt:serverTimestamp(),updatedAt:serverTimestamp(),revision:2,clientMutationId:removeId});
  removal.set(doc(owner,...activityPath,removeId),{actorUid:'owner-a',action:'comment-deleted',boardId:'revision-board',clientMutationId:removeId,createdAt:serverTimestamp()});
  await assertSucceeds(removal.commit());
  await assertFails(deleteDoc(doc(owner,...commentPath,createId)));
  const afterDeleteId='comment-mutation-0009', afterDelete=writeBatch(editor);
  afterDelete.update(comment,{body:'Cannot restore',deletedAt:null,updatedAt:serverTimestamp(),revision:3,clientMutationId:afterDeleteId});
  afterDelete.set(doc(editor,...activityPath,afterDeleteId),{actorUid:'editor-a',action:'comment-updated',boardId:'revision-board',clientMutationId:afterDeleteId,createdAt:serverTimestamp()});
  await assertFails(afterDelete.commit());
});

test('cloud parents cannot be hard deleted and orphaned comments fail closed', async () => {
  for (const kind of ['workspace','board','list','card']) {
    const workspaceId=`lifecycle-${kind}`, uid=`owner-${kind}`, boardId='lifecycle-board', listId='lifecycle-list', cardId='lifecycle-card', commentId='lifecycle-comment-0001';
    await env.withSecurityRulesDisabled(async context => {
      const db=context.firestore(), at=Timestamp.now();
      await setDoc(doc(db,'workspaces',workspaceId),{name:workspaceId,ownerUid:uid,schemaVersion:1,status:'ready'});
      await setDoc(doc(db,'workspaces',workspaceId,'members',uid),{uid,role:'owner',emailLower:`${uid}@example.com`,displayName:uid});
      await setDoc(doc(db,'workspaces',workspaceId,'boards',boardId),{title:'Lifecycle',rank:0,revision:0,clientMutationId:'lifecycle-board-0001',updatedAt:at});
      await setDoc(doc(db,'workspaces',workspaceId,'boards',boardId,'lists',listId),{title:'Lifecycle',rank:0,revision:0,clientMutationId:'lifecycle-list-0001',updatedAt:at});
      await setDoc(doc(db,'workspaces',workspaceId,'boards',boardId,'cards',cardId),{title:'Lifecycle',listId,rank:0,revision:0,clientMutationId:'lifecycle-card-0001',updatedAt:at,assigneeUids:[]});
      await setDoc(doc(db,'workspaces',workspaceId,'boards',boardId,'cards',cardId,'comments',commentId),{authorUid:uid,body:'Retained comment',createdAt:at,updatedAt:at,deletedAt:null,revision:0,clientMutationId:commentId});
    });
    const owner=dbFor(uid), comment=doc(owner,'workspaces',workspaceId,'boards',boardId,'cards',cardId,'comments',commentId);
    await assertSucceeds(getDoc(comment));
    const parent = kind==='workspace' ? doc(owner,'workspaces',workspaceId)
      : kind==='board' ? doc(owner,'workspaces',workspaceId,'boards',boardId)
      : kind==='list' ? doc(owner,'workspaces',workspaceId,'boards',boardId,'lists',listId)
      : doc(owner,'workspaces',workspaceId,'boards',boardId,'cards',cardId);
    await assertFails(deleteDoc(parent));
    await env.withSecurityRulesDisabled(context => deleteDoc(kind==='workspace' ? doc(context.firestore(),'workspaces',workspaceId)
      : kind==='board' ? doc(context.firestore(),'workspaces',workspaceId,'boards',boardId)
      : kind==='list' ? doc(context.firestore(),'workspaces',workspaceId,'boards',boardId,'lists',listId)
      : doc(context.firestore(),'workspaces',workspaceId,'boards',boardId,'cards',cardId)));
    await assertFails(getDoc(comment));
    await assertFails(getDocs(query(collection(owner,'workspaces',workspaceId,'boards',boardId,'cards',cardId,'comments'),limit(25))));
    const mutationId=`orphan-${kind}-mutation-0001`, update=writeBatch(owner);
    update.update(comment,{body:'Orphan mutation',updatedAt:serverTimestamp(),revision:1,clientMutationId:mutationId});
    update.set(doc(owner,'workspaces',workspaceId,'activity',mutationId),{actorUid:uid,action:'comment-updated',boardId,clientMutationId:mutationId,createdAt:serverTimestamp()});
    await assertFails(update.commit());
  }
});

test('owner bootstrap and backup-first board upload are permitted as separate verified writes', async () => {
  const owner = dbFor('migration-owner', 'migration@example.com');
  const bootstrap = writeBatch(owner);
  bootstrap.set(doc(owner, 'workspaces', 'migration-workspace'), {
    name:'Migrated workspace', ownerUid:'migration-owner', schemaVersion:4,
    activeBoardId:'board-1', status:'initializing'
  });
  bootstrap.set(doc(owner, 'workspaces', 'migration-workspace', 'members', 'migration-owner'), {
    uid:'migration-owner', role:'owner', emailLower:'migration@example.com'
  });
  bootstrap.set(doc(owner, 'users', 'migration-owner'), {
    uid:'migration-owner', emailLower:'migration@example.com', workspaceIds:['migration-workspace']
  });
  await assertSucceeds(bootstrap.commit());

  const upload = writeBatch(owner);
  upload.set(doc(owner, 'workspaces', 'migration-workspace', 'boards', 'board-1'), {
    title:'Imported board', rank:0, snapshot:{id:'board-1', title:'Imported board', lists:[]}, revision:0, clientMutationId:'mutation-identifier-0005'
  });
  upload.update(doc(owner, 'workspaces', 'migration-workspace'), {status:'ready'});
  await assertSucceeds(upload.commit());
  assert.equal((await getDoc(doc(owner, 'workspaces', 'migration-workspace', 'boards', 'board-1'))).exists(), true);
});

test('only a verified email addressed by an active invite can read or accept it', async () => {
  const wrong = dbFor('wrong-user', 'wrong@example.com');
  const unverified = dbFor('invitee-unverified', 'invitee@example.com', false);
  await assertFails(getDoc(doc(wrong, 'workspaces', 'alpha', 'invites', 'invite-accept')));
  await assertFails(getDoc(doc(unverified, 'workspaces', 'alpha', 'invites', 'invite-accept')));

  const invitee = dbFor('invitee-uid', 'invitee@example.com');
  await assertSucceeds(acceptInvite(invitee, 'alpha', 'invite-accept', 'invitee-uid', 'invitee@example.com', 'editor'));
  assert.equal((await getDoc(doc(invitee, 'workspaces', 'alpha'))).exists(), true);
  await assertFails(acceptInvite(invitee, 'alpha', 'invite-accept', 'invitee-uid', 'invitee@example.com', 'editor'));
});

test('invite acceptance cannot be completed without the matching membership write', async () => {
  const invitee = dbFor('incomplete-uid', 'incomplete@example.com');
  await assertFails(updateDoc(doc(invitee, 'workspaces', 'alpha', 'invites', 'invite-incomplete'), {
    acceptedAt:serverTimestamp(), acceptedBy:'incomplete-uid'
  }));
});

test('invite acceptance must atomically add the workspace to the accepting user profile', async () => {
  const invitee = dbFor('profile-missing-uid', 'profile-required@example.com');
  await assertFails(acceptInvite(invitee, 'alpha', 'invite-profile-required', 'profile-missing-uid', 'profile-required@example.com', 'editor', false));
});

test('expired invitations deny read and acceptance', async () => {
  const expired = dbFor('expired-uid', 'expired@example.com');
  await assertFails(getDoc(doc(expired, 'workspaces', 'alpha', 'invites', 'invite-expired')));
  await assertFails(acceptInvite(expired, 'alpha', 'invite-expired', 'expired-uid', 'expired@example.com', 'viewer'));
});

test('owner-created invitations enforce editor/viewer role and seven-day expiry', async () => {
  const owner = dbFor('owner-a');
  await assertSucceeds(setDoc(doc(owner, 'workspaces', 'alpha', 'invites', 'invite-valid'), invitation({emailLower:'valid@example.com'})));
  await assertFails(setDoc(doc(owner, 'workspaces', 'alpha', 'invites', 'invite-owner-role'), invitation({emailLower:'owner-role@example.com', role:'owner'})));
  await assertFails(setDoc(doc(owner, 'workspaces', 'alpha', 'invites', 'invite-long'), invitation({emailLower:'long@example.com', expiresInDays:8})));
});

test('owner may change a non-owner role but cannot change protected member identity data', async () => {
  const owner = dbFor('owner-a');
  await assertSucceeds(updateDoc(doc(owner, 'workspaces', 'alpha', 'members', 'editor-a'), {role:'viewer'}));
  await assertFails(updateDoc(doc(owner, 'workspaces', 'alpha', 'members', 'editor-a'), {emailLower:'forged@example.com'}));
});

test('invitee cannot tamper with the invited role during atomic acceptance', async () => {
  const invitee = dbFor('tamper-uid', 'tamper@example.com');
  await assertFails(acceptInvite(invitee, 'alpha', 'invite-tamper', 'tamper-uid', 'tamper@example.com', 'viewer'));
});

test('revoked invitation becomes unreadable and cannot be accepted or reused', async () => {
  const owner = dbFor('owner-a');
  await assertSucceeds(updateDoc(doc(owner, 'workspaces', 'alpha', 'invites', 'invite-revocable'), {revokedAt:serverTimestamp()}));
  const invitee = dbFor('revoked-uid', 'revoked@example.com');
  await assertFails(getDoc(doc(invitee, 'workspaces', 'alpha', 'invites', 'invite-revocable')));
  await assertFails(acceptInvite(invitee, 'alpha', 'invite-revocable', 'revoked-uid', 'revoked@example.com', 'viewer'));
  await assertFails(updateDoc(doc(owner, 'workspaces', 'alpha', 'invites', 'invite-revocable'), {revokedAt:null}));
});

test('non-owner self-leave atomically removes membership and profile discovery, while owner deletion remains protected', async () => {
  const viewer = dbFor('viewer-a'), leave = writeBatch(viewer);
  leave.delete(doc(viewer, 'workspaces', 'alpha', 'members', 'viewer-a'));
  leave.set(doc(viewer, 'users', 'viewer-a'), {workspaceIds:[]}, {merge:true});
  await assertSucceeds(leave.commit());
  await assertFails(deleteDoc(doc(dbFor('owner-a'), 'workspaces', 'alpha', 'members', 'owner-a')));
});

test('former-member assignments permit unrelated edits but must be cleared when assignments change', async () => {
  const owner=dbFor('owner-a'), card=doc(owner,'workspaces','alpha','boards','assignment-board','cards','assignment-card');
  await assertSucceeds(updateDoc(card,{title:'Unrelated edit', revision:1, clientMutationId:'assignment-mutation-0005'}));
  await assertFails(updateDoc(card,{assigneeUids:['viewer-a'], revision:2, clientMutationId:'assignment-mutation-0006'}));
  await assertSucceeds(updateDoc(card,{assigneeUids:['editor-a'], revision:2, clientMutationId:'assignment-mutation-0007'}));
});

test('ownership transfer rejects partial changes and only permits a complete atomic transfer', async () => {
  const owner = dbFor('owner-transfer', 'owner-transfer@example.com');
  await assertFails(updateDoc(doc(owner, 'workspaces', 'transfer'), {ownerUid:'successor'}));

  const transfer = writeBatch(owner);
  transfer.update(doc(owner, 'workspaces', 'transfer'), {ownerUid:'successor', updatedAt:serverTimestamp()});
  transfer.update(doc(owner, 'workspaces', 'transfer', 'members', 'owner-transfer'), {role:'editor'});
  transfer.update(doc(owner, 'workspaces', 'transfer', 'members', 'successor'), {role:'owner'});
  await assertSucceeds(transfer.commit());

  const successor = dbFor('successor', 'successor@example.com');
  await assertSucceeds(setDoc(doc(successor, 'workspaces', 'transfer', 'members', 'post-transfer-viewer'), {
    uid:'post-transfer-viewer', role:'viewer', emailLower:'post-transfer-viewer@example.com'
  }));
  await assertSucceeds(setDoc(doc(owner, 'workspaces', 'transfer', 'boards', 'after-transfer'), {title:'Editor still allowed', revision:0, clientMutationId:'test-mutation-id-0001'}));
  await assertFails(setDoc(doc(owner, 'workspaces', 'transfer', 'members', 'former-owner-escalation'), {
    uid:'former-owner-escalation', role:'viewer', emailLower:'former-owner-escalation@example.com'
  }));
});

test('activity is member-readable, immutable, actor-bound, and shape-bound', async () => {
  const valid = {actorUid:'invitee-uid', action:'card-created', boardId:'board-1', clientMutationId:'activity-mutation-id-0001', createdAt:serverTimestamp()};
  await assertSucceeds(setDoc(doc(dbFor('invitee-uid'), 'workspaces', 'alpha', 'activity', 'activity-mutation-id-0001'), valid));
  await assertSucceeds(getDoc(doc(dbFor('owner-a'), 'workspaces', 'alpha', 'activity', 'activity-mutation-id-0001')));
  await assertFails(setDoc(doc(dbFor('viewer-a'), 'workspaces', 'alpha', 'activity', 'activity-mutation-id-0002'), {...valid, actorUid:'viewer-a', clientMutationId:'activity-mutation-id-0002'}));
  await assertFails(setDoc(doc(dbFor('invitee-uid'), 'workspaces', 'alpha', 'activity', 'activity-mutation-id-0003'), {...valid, actorUid:'owner-a', clientMutationId:'activity-mutation-id-0003'}));
  await assertFails(setDoc(doc(dbFor('invitee-uid'), 'workspaces', 'alpha', 'activity', 'wrong-id'), {...valid, clientMutationId:'activity-mutation-id-0004'}));
  await assertFails(updateDoc(doc(dbFor('editor-a'), 'workspaces', 'alpha', 'activity', 'activity-mutation-id-0001'), {action:'card-moved'}));
});
