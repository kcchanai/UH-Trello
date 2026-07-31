import test, {after, before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
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
      await setDoc(doc(db, 'workspaces', workspaceId), {name: workspaceId, ownerUid, schemaVersion: 1});
      await setDoc(doc(db, 'workspaces', workspaceId, 'members', ownerUid), {uid: ownerUid, role: 'owner', emailLower: `${ownerUid}@example.com`});
    };
    await seed('alpha', 'owner-a');
    await seed('beta', 'owner-b');
    await setDoc(doc(db, 'workspaces', 'alpha', 'members', 'editor-a'), {uid: 'editor-a', role: 'editor', emailLower: 'editor@example.com'});
    await setDoc(doc(db, 'workspaces', 'alpha', 'members', 'viewer-a'), {uid: 'viewer-a', role: 'viewer', emailLower: 'viewer@example.com'});
    await setDoc(doc(db, 'workspaces', 'alpha', 'invites', 'invite-123'), {
      emailLower: 'invitee@example.com', role: 'editor', acceptedAt: null, acceptedBy: null, revokedAt: null,
      expiresAt: Timestamp.fromMillis(Date.now() + 3_600_000)
    });
  });
});

after(async () => env?.cleanup());

const dbFor = (uid, email = `${uid}@example.com`, verified = true) =>
  env.authenticatedContext(uid, {email, email_verified: verified}).firestore();

test('anonymous and cross-workspace reads are denied', async () => {
  const anonymous = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonymous, 'workspaces', 'alpha')));
  await assertFails(getDoc(doc(dbFor('owner-b'), 'workspaces', 'alpha')));
  await assertSucceeds(getDoc(doc(dbFor('viewer-a'), 'workspaces', 'alpha')));
});

test('owner can add a member but viewer cannot escalate or write board content', async () => {
  await assertSucceeds(setDoc(doc(dbFor('owner-a'), 'workspaces', 'alpha', 'members', 'new-viewer'), {
    uid: 'new-viewer', role: 'viewer', emailLower: 'new-viewer@example.com'
  }));
  await assertFails(setDoc(doc(dbFor('viewer-a'), 'workspaces', 'alpha', 'members', 'viewer-a'), {
    uid: 'viewer-a', role: 'owner', emailLower: 'viewer@example.com'
  }, {merge: true}));
  await assertFails(setDoc(doc(dbFor('viewer-a'), 'workspaces', 'alpha', 'boards', 'blocked'), {title: 'Blocked'}));
});

test('editor can write board content but cannot manage members', async () => {
  await assertSucceeds(setDoc(doc(dbFor('editor-a'), 'workspaces', 'alpha', 'boards', 'board-1'), {
    title: 'Shared board', rank: 'a0'
  }));
  await assertFails(setDoc(doc(dbFor('editor-a'), 'workspaces', 'alpha', 'members', 'intruder'), {
    uid: 'intruder', role: 'editor', emailLower: 'intruder@example.com'
  }));
});

test('only the verified email addressed by an active invite can accept it', async () => {
  const wrong = dbFor('wrong-user', 'wrong@example.com');
  await assertFails(getDoc(doc(wrong, 'workspaces', 'alpha', 'invites', 'invite-123')));

  const invitee = dbFor('invitee-uid', 'invitee@example.com');
  const batch = writeBatch(invitee);
  batch.set(doc(invitee, 'workspaces', 'alpha', 'members', 'invitee-uid'), {
    uid: 'invitee-uid', role: 'editor', emailLower: 'invitee@example.com', inviteId: 'invite-123'
  });
  batch.update(doc(invitee, 'workspaces', 'alpha', 'invites', 'invite-123'), {
    acceptedAt: serverTimestamp(), acceptedBy: 'invitee-uid'
  });
  await assertSucceeds(batch.commit());
  const accepted = await getDoc(doc(invitee, 'workspaces', 'alpha'));
  assert.equal(accepted.exists(), true);
});
