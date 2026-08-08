import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeCloudSyncController} from '../src/cloud-sync-controller.js';

const tick = () => new Promise(resolve => setImmediate(resolve));

function harness({verifyWorkspaceAccess = async () => 'editor'} = {}) {
  const events = new EventTarget();
  globalThis.window = events;
  Object.defineProperty(globalThis, 'navigator', {value:{onLine:true}, configurable:true});
  const calls = {subscriptions:[], unsubscribed:0, statuses:[], boards:[], roles:[], names:[], removed:[]};
  let mode = {kind:'local'}, boardId = 'board-a';
  globalThis.FlowboardApp = {
    getMode:() => ({...mode}), getActiveBoardId:() => boardId,
    setCloudSyncStatus:(...args) => calls.statuses.push(args),
    applyRemoteCloudBoard:value => calls.boards.push(value),
    updateCloudRole:role => calls.roles.push(role),
    updateCloudWorkspaceName:(...args) => calls.names.push(args),
    handleCloudAccessRemoved:message => { calls.removed.push(message); mode = {kind:'local'}; }
  };
  const adapter = {verifyWorkspaceAccess, async subscribeWorkspace(options) { calls.subscriptions.push(options); return () => { calls.unsubscribed += 1; }; }};
  const controller = initializeCloudSyncController(adapter);
  return {calls, controller, setMode:value => { mode = value; }, getMode:() => ({...mode}), setBoard:value => { boardId = value; }, events};
}

test('cloud sync scopes listeners to the active workspace and board and restarts on board change', async () => {
  const h = harness();
  h.controller.setSession({uid:'member-a'});
  h.setMode({kind:'cloud', id:'workspace-a', role:'editor'});
  h.events.dispatchEvent(new Event('flowboard:cloud-preview-change'));
  await tick();
  assert.equal(h.calls.subscriptions.length, 1);
  assert.equal(h.calls.subscriptions[0].workspaceId, 'workspace-a');
  assert.equal(h.calls.subscriptions[0].boardId, 'board-a');
  h.calls.subscriptions[0].onStatus('synced');
  h.calls.subscriptions[0].onWorkspace({status:'ready', name:'Renamed workspace'});
  h.calls.subscriptions[0].onMembership('viewer');
  h.calls.subscriptions[0].onBoard({board:{id:'board-a'}});
  assert.deepEqual(h.calls.statuses.at(-1), ['Synced', '']);
  assert.deepEqual(h.calls.names, [['workspace-a', 'Renamed workspace']]);
  assert.deepEqual(h.calls.roles, ['viewer']);
  assert.equal(h.calls.boards.length, 1);

  h.setBoard('board-b');
  h.events.dispatchEvent(new Event('flowboard:active-board-change'));
  await tick();
  assert.equal(h.calls.unsubscribed, 1);
  assert.equal(h.calls.subscriptions.at(-1).boardId, 'board-b');
});

test('cloud sync reports offline state and clears cloud mode on sign-out', async () => {
  const h = harness();
  h.setMode({kind:'cloud-preview', id:'workspace-a'});
  h.controller.setSession({uid:'member-a'});
  await tick();
  h.events.dispatchEvent(new Event('offline'));
  assert.deepEqual(h.calls.statuses.at(-1), ['Offline', '']);
  h.controller.setSession(null);
  assert.equal(h.calls.unsubscribed, 1);
  assert.match(h.calls.removed.at(-1), /Signed out/);
});

test('cloud sync verifies membership on reconnect and clears revoked cloud mode', async () => {
  let revoked = false;
  const h = harness({verifyWorkspaceAccess:async () => {
    if (revoked) throw Object.assign(new Error('denied'), {code:'permission-denied'});
    return 'editor';
  }});
  h.setMode({kind:'cloud', id:'workspace-a', role:'editor'});
  h.controller.setSession({uid:'member-a'});
  await tick();
  assert.equal(h.calls.subscriptions.length, 1);
  revoked = true;
  h.events.dispatchEvent(new Event('online'));
  await tick();
  assert.equal(h.calls.unsubscribed, 1);
  assert.match(h.calls.removed.at(-1), /access was removed/i);
});

test('archived workspace snapshot stops once and does not reconnect', async () => {
  const h = harness();
  h.setMode({kind:'cloud', id:'workspace-a', role:'editor'});
  h.controller.setSession({uid:'member-a'});
  await tick();
  assert.equal(h.calls.subscriptions.length, 1);

  const listener = h.calls.subscriptions[0];
  listener.onWorkspace({status:'archived', name:'Archived workspace'});
  assert.equal(h.calls.unsubscribed, 1);
  assert.equal(h.calls.removed.length, 1);
  assert.match(h.calls.removed[0], /archived/i);
  assert.equal(h.getMode().kind, 'local');

  listener.onWorkspace({status:'ready', name:'Late workspace name'});
  listener.onError(Object.assign(new Error('late archived callback'), {code:'permission-denied'}));
  assert.equal(h.calls.unsubscribed, 1);
  assert.equal(h.calls.removed.length, 1);
  assert.equal(h.calls.names.length, 0);

  h.events.dispatchEvent(new Event('online'));
  await tick();
  assert.equal(h.calls.subscriptions.length, 1);
});
