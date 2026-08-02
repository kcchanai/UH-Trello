const test = require('node:test');
const assert = require('node:assert/strict');
const State = require('../state-core.js');

test('legacy data migrates to schema 4 with usable collaboration metadata', () => {
  const migrated = State.migrateLegacy([{title: 'Inbox', cards: [{title: 'Call "Sam"', color: 'red', meta: 'today'}]}]);
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.boards[0].lists[0].cards[0].title, 'Call "Sam"');
  assert.equal(migrated.boards[0].collaboration.members[0].role, 'owner');
});

test('normalization safely upgrades old workspace data and rejects invalid envelope', () => {
  const normalized = State.normalizeWorkspace({schemaVersion: 1, boards: [{title: 'Old', lists: [{title: 'Next', cards: [{title: 'Task', labels: ['purple'], assigneeUids:['member-1','member-1','bad uid']}]}]}]});
  assert.equal(normalized.schemaVersion, 4);
  assert.equal(normalized.boards[0].lists[0].cards[0].labels[0].color, 'purple');
  assert.equal(normalized.boards[0].collaboration.access, 'private');
  assert.deepEqual(normalized.boards[0].lists[0].cards[0].assigneeUids, ['member-1']);
  assert.equal(State.validWorkspace({schemaVersion: 99, boards: []}), false);
});

test('filtering covers card fields and due/label states without mutating the card', () => {
  const card = {title: 'Write launch copy', description: 'For home page', labels: [{color: 'orange', name: 'Marketing'}], checklist: [{text: 'Review with team', done: false}], assignees: ['Ari'], dueDate: '2030-04-10'};
  assert.equal(State.cardMatches(card, 'team'), true);
  assert.equal(State.cardMatches(card, 'ari', {due: 'upcoming', label: 'orange'}, '2030-04-01'), true);
  assert.equal(State.cardMatches(card, 'launch', {due: 'today', label: 'all'}, '2030-04-11'), false);
  assert.equal(card.labels[0].name, 'Marketing');
});

test('import recognition validates workspace and board shapes before mutation', () => {
  const board = State.makeBoard('tasks');
  const workspace = {schemaVersion: 4, activeBoardId: board.id, boards: [board], preferences: {theme: 'dark'}};
  assert.equal(State.describeImport(workspace).counts.boards, 1);
  assert.equal(State.describeImport({flowboardExport: 'board', board}).importedBoard.title, 'Personal tasks');
  assert.equal(State.describeImport({boards: 'not-an-array'}), null);
});

test('CSV export escapes commas, quotes, and newlines', () => {
  const board = {title: 'Q3, plan', lists: [{title: 'Inbox', cards: [{title: 'Say "hello"', description: 'Line one\nLine two', labels: [], assignees: [], archived: false}]}]};
  const csv = State.csvForBoard(board);
  assert.match(csv, /"Q3, plan"/);
  assert.match(csv, /"Say ""hello"""/);
  assert.match(csv, /"Line one\nLine two"/);
});

test('bounded undo restores the pre-mutation snapshot without aliasing', () => {
  const original = State.makeWorkspace();
  const history = State.pushUndo([], 'add card', original, 2);
  original.boards[0].title = 'Changed after snapshot';
  const result = State.takeUndo(history);
  assert.equal(result.item.workspace.boards[0].title, 'Website Launch');
  assert.equal(result.history.length, 0);
});
