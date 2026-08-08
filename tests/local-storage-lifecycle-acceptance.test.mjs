import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../scripts/local-storage-lifecycle-acceptance.js', import.meta.url), 'utf8');

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem:key => values.has(key) ? values.get(key) : null,
    setItem:(key,value) => values.set(key, String(value)),
    removeItem:key => values.delete(key)
  };
}

function context(localStorage, sessionStorage, mode = 'local') {
  const messages = [];
  const console = {
    log:value => messages.push(String(value)),
    error:value => messages.push(String(value)),
    table:() => {}
  };
  return {
    context:{localStorage,sessionStorage,TextEncoder,console,FlowboardApp:{getMode:()=>({kind:mode})}},
    messages
  };
}

function run(target) {
  return vm.runInNewContext(source, target);
}

test('localStorage lifecycle probe captures and passes exact unchanged strings', () => {
  const local = storage({'flowboard-workspace':'{"board":"local"}'});
  const session = storage();
  const first = context(local, session);
  assert.equal(run(first.context).status, 'captured');
  assert.ok(first.messages.includes('LOCAL STORAGE BASELINE CAPTURED'));

  const second = context(local, session);
  const result = run(second.context);
  assert.equal(result.status, 'passed');
  assert.ok(second.messages.includes('LOCAL STORAGE BYTE EQUALITY PASS'));
  assert.equal(session.getItem('flowboard-lifecycle-local-storage-baseline-v1'), null);
});

test('localStorage lifecycle probe fails an exact changed string and preserves baseline', () => {
  const local = storage({'flowboard-workspace':'before','flowboard-data':'legacy'});
  const session = storage();
  run(context(local, session).context);
  local.setItem('flowboard-workspace', 'after');

  const checked = context(local, session);
  const result = run(checked.context);
  assert.equal(result.status, 'failed');
  assert.ok(checked.messages.includes('LOCAL STORAGE BYTE EQUALITY FAIL'));
  assert.notEqual(session.getItem('flowboard-lifecycle-local-storage-baseline-v1'), null);
});

test('localStorage lifecycle probe blocks capture outside local mode', () => {
  const local = storage({'flowboard-workspace':'local'});
  const session = storage();
  const checked = context(local, session, 'cloud');
  assert.equal(run(checked.context).status, 'blocked');
  assert.ok(checked.messages.includes('LOCAL STORAGE CHECK BLOCKED: return to local mode first.'));
  assert.equal(session.getItem('flowboard-lifecycle-local-storage-baseline-v1'), null);
});
