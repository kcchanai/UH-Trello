import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceLifecycleState} from '../src/workspace-lifecycle-ui.js';

const entry = overrides => ({ownerUid:'owner', role:'owner', status:'ready', migration:{state:'verified'}, ...overrides});

test('workspace lifecycle presentation exposes controls only to the owner', () => {
  assert.deepEqual(workspaceLifecycleState(entry({}), 'owner'), {archived:false, owner:true, editable:true});
  assert.deepEqual(workspaceLifecycleState(entry({role:'editor'}), 'editor'), {archived:false, owner:false, editable:true});
  assert.deepEqual(workspaceLifecycleState(entry({role:'viewer'}), 'viewer'), {archived:false, owner:false, editable:false});
});

test('archived workspace presentation is retained, owner-restorable, and never openable', () => {
  assert.deepEqual(workspaceLifecycleState(entry({status:'archived'}), 'owner'), {archived:true, owner:true, editable:false});
  assert.deepEqual(workspaceLifecycleState(entry({status:'archived', role:'editor'}), 'editor'), {archived:true, owner:false, editable:false});
});
