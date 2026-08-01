import test from 'node:test';
import assert from 'node:assert/strict';
import {granularizeBoard, rehydrateGranularWorkspace} from '../src/granular-workspace.js';

const legacyBoard = {
  id:'board-a', title:'Migration board', createdAt:'2026-01-01', updatedAt:'2026-01-02', archived:false,
  lists:[
    {id:'list-a', title:'First', archived:false, cards:[{id:'card-a', title:'Alpha', description:'Keep me', labels:[], checklist:[], activity:[], archived:false}]},
    {id:'list-b', title:'Second', archived:true, cards:[{id:'card-b', title:'Beta', labels:[], checklist:[], activity:[], archived:true}]}
  ]
};

test('granular migration preserves stable IDs, order, rich card fields, and archive state', () => {
  const granular = granularizeBoard(legacyBoard, 3);
  assert.equal(granular.board.id, 'board-a');
  assert.equal(granular.board.rank, 3);
  assert.equal(granular.lists.length, 2);
  assert.equal(granular.cards.length, 2);
  assert.deepEqual(granular.cards.map(card => [card.id, card.listId, card.rank]), [['card-a','list-a',0], ['card-b','list-b',0]]);
  const workspace = rehydrateGranularWorkspace({schemaVersion:4, activeBoardId:'board-a'}, [granular]);
  assert.deepEqual(workspace.boards, [legacyBoard]);
});

test('granular migration rejects duplicate IDs rather than creating ambiguous documents', () => {
  const invalid = structuredClone(legacyBoard);
  invalid.lists[1].id = 'list-a';
  assert.throws(() => granularizeBoard(invalid, 0), /duplicate list/i);
});
