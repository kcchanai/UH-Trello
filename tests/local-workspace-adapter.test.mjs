import test from 'node:test';
import assert from 'node:assert/strict';
import State from '../state-core.js';
import {createLocalWorkspaceAdapter} from '../src/adapters/local-workspace-adapter.js';
import {CloudNotConfiguredError} from '../src/adapters/adapter-contract.js';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function makeAdapter(storage) {
  return createLocalWorkspaceAdapter({
    storage,
    validWorkspace: State.validWorkspace,
    normalizeWorkspace: State.normalizeWorkspace,
    migrateLegacy: State.migrateLegacy,
    makeWorkspace: State.makeWorkspace,
    clone: State.clone
  });
}

test('LocalWorkspaceAdapter creates, saves, reloads, and bounds recovery backups', () => {
  const storage = memoryStorage();
  const adapter = makeAdapter(storage);
  const fresh = adapter.loadWorkspace();
  assert.equal(fresh.source, 'fresh');
  assert.equal(fresh.workspace.schemaVersion, State.SCHEMA_VERSION);

  fresh.workspace.boards[0].title = 'Saved locally through adapter';
  assert.equal(adapter.saveWorkspace(fresh.workspace).ok, true);
  const reloaded = adapter.loadWorkspace();
  assert.equal(reloaded.workspace.boards[0].title, 'Saved locally through adapter');
  assert.equal(adapter.listRecoveryBackups().length, 1);
});

test('LocalWorkspaceAdapter preserves legacy migration without UI persistence access', () => {
  const storage = memoryStorage({
    'flowboard-data': JSON.stringify([{title:'Inbox', cards:[{title:'Migrated task'}]}])
  });
  const adapter = makeAdapter(storage);
  const result = adapter.loadWorkspace();
  assert.equal(result.source, 'legacy');
  assert.equal(result.migrated, true);
  assert.equal(result.workspace.boards[0].lists[0].cards[0].title, 'Migrated task');
  assert.equal(storage.getItem('flowboard-data'), null);
});

test('LocalWorkspaceAdapter does not impersonate cloud functionality', async () => {
  const adapter = makeAdapter(memoryStorage());
  assert.equal(adapter.getSession(), null);
  await assert.rejects(adapter.signInWithGoogle(), CloudNotConfiguredError);
  await assert.rejects(adapter.listWorkspaces(), CloudNotConfiguredError);
});
