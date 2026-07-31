(() => {
  'use strict';

  const STORAGE_KEY = 'flowboard-workspace';
  const LEGACY_KEY = 'flowboard-data';
  const SCHEMA_VERSION = 1;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const uid = () => (crypto?.randomUUID?.() || `fb-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const now = () => new Date().toISOString();
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const icon = name => `<svg aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
  const allowedColors = new Set(['green', 'purple', 'orange', 'red']);

  const seedLists = [
    { title:'Ideas', cards:[['purple', 'Research competitor landing pages', '💬 3'], ['orange', 'Collect customer testimonials', '📎 2'], ['', 'Plan launch announcement', '']] },
    { title:'To do', cards:[['red', 'Write homepage copy', '📅 Jul 31'], ['orange', 'Create social media graphics', '📎 4'], ['', 'Set up analytics events', '']] },
    { title:'In progress', cards:[['purple', 'Design responsive homepage', '💬 5'], ['', 'Build email signup form', '📅 Aug 2']] },
    { title:'Done', cards:[['', 'Choose brand colour palette', '✓ Complete'], ['', 'Set project goals', '✓ Complete']] }
  ];

  function makeCard(title, color = '', meta = '') {
    return { id:uid(), title:String(title || 'Untitled card'), description:'', labels:color ? [normalizeColor(color)] : [], meta:String(meta || ''), createdAt:now(), updatedAt:now(), archived:false };
  }
  function makeList(title, cards = []) { return { id:uid(), title:String(title || 'Untitled list'), cards, createdAt:now(), updatedAt:now(), archived:false }; }
  function makeSeedBoard() {
    return { id:uid(), title:'Website Launch', lists:seedLists.map(list => makeList(list.title, list.cards.map(card => makeCard(card[1], card[0], card[2])))), createdAt:now(), updatedAt:now(), archived:false };
  }
  function makeWorkspace() { const board = makeSeedBoard(); return { schemaVersion:SCHEMA_VERSION, activeBoardId:board.id, boards:[board], preferences:{ theme:'system' } }; }
  function normalizeColor(color) { return allowedColors.has(color) ? color : ''; }
  function validCard(card) { return card && typeof card.id === 'string' && typeof card.title === 'string'; }
  function normalizeCard(card) {
    return { id:card.id || uid(), title:String(card.title || 'Untitled card'), description:String(card.description || ''), labels:Array.isArray(card.labels) ? card.labels.map(normalizeColor).filter(Boolean) : (card.color ? [normalizeColor(card.color)].filter(Boolean) : []), meta:String(card.meta || ''), createdAt:card.createdAt || now(), updatedAt:card.updatedAt || now(), archived:Boolean(card.archived) };
  }
  function validWorkspace(data) { return data && data.schemaVersion === SCHEMA_VERSION && Array.isArray(data.boards) && data.boards.length && data.boards.every(board => board && typeof board.id === 'string' && typeof board.title === 'string' && Array.isArray(board.lists) && board.lists.every(list => list && typeof list.id === 'string' && typeof list.title === 'string' && Array.isArray(list.cards) && list.cards.every(validCard))); }
  function normalizeWorkspace(data) {
    const boards = data.boards.map(board => ({ id:board.id || uid(), title:String(board.title || 'Untitled board'), lists:board.lists.map(list => makeList(list.title, list.cards.map(normalizeCard))), createdAt:board.createdAt || now(), updatedAt:board.updatedAt || now(), archived:Boolean(board.archived) }));
    const activeBoardId = boards.some(board => board.id === data.activeBoardId) ? data.activeBoardId : boards[0].id;
    return { schemaVersion:SCHEMA_VERSION, activeBoardId, boards, preferences:{ theme:['light','dark','system'].includes(data.preferences?.theme) ? data.preferences.theme : 'system' } };
  }
  function migrateLegacy(data) {
    if (!Array.isArray(data)) return null;
    const board = { id:uid(), title:'Website Launch', lists:data.map(list => makeList(list?.title, Array.isArray(list?.cards) ? list.cards.map(card => makeCard(card?.title, card?.color, card?.meta)) : [])), createdAt:now(), updatedAt:now(), archived:false };
    return { schemaVersion:SCHEMA_VERSION, activeBoardId:board.id, boards:[board], preferences:{ theme:'system' } };
  }

  let storageAvailable = true;
  let state;
  let searchTerm = '';
  let draggedCardId = null;
  let pendingAction = null;
  let toastTimer;

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (validWorkspace(parsed)) return normalizeWorkspace(parsed);
        throw new Error('Unsupported workspace schema');
      }
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const migrated = migrateLegacy(JSON.parse(legacy));
        if (migrated) {
          persist(migrated, false);
          localStorage.removeItem(LEGACY_KEY);
          queueMicrotask(() => say('Your existing board was safely upgraded.'));
          return migrated;
        }
      }
    } catch (error) {
      console.warn('Flowboard could not restore saved data.', error);
      queueMicrotask(() => say('Saved data could not be read. A new local board was created.'));
    }
    const fresh = makeWorkspace();
    persist(fresh, false);
    return fresh;
  }
  function persist(nextState = state, announce = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      storageAvailable = true;
      if (announce) say('Saved locally');
      return true;
    } catch (error) {
      storageAvailable = false;
      console.error('Flowboard could not save data.', error);
      say('Could not save locally — check browser storage.');
      return false;
    }
  }
  function activeBoard() { return state.boards.find(board => board.id === state.activeBoardId) || state.boards[0]; }
  function findList(listId) { return activeBoard().lists.find(list => list.id === listId); }
  function findCard(cardId) { for (const list of activeBoard().lists) { const card = list.cards.find(item => item.id === cardId); if (card) return { card, list }; } return null; }
  function mutate(message, mutation) { mutation(); activeBoard().updatedAt = now(); persist(); render(); if (message) say(message); }
  function say(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1900); }

  function applyTheme() {
    const preference = state.preferences.theme;
    const isDark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    $('meta[name="theme-color"]').content = isDark ? '#182d54' : '#0f6cbd';
    const toggle = $('#theme-toggle');
    toggle.innerHTML = icon(isDark ? 'sun' : 'moon');
    toggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
    toggle.title = toggle.getAttribute('aria-label');
  }
  function cardMarkup(card) {
    const labels = card.labels.length ? `<div class="labels">${card.labels.map(color => `<span class="label ${color}" aria-label="${color} label"></span>`).join('')}</div>` : '';
    const meta = card.meta ? `<div class="card-meta"><span class="meta-chip ${card.meta.includes('Complete') ? 'complete' : ''}">${esc(card.meta)}</span></div>` : '';
    return `<article class="card" draggable="true" data-card-id="${card.id}">${labels}<span class="card-title">${esc(card.title)}</span><button class="card-delete" type="button" data-action="delete-card" aria-label="Delete ${esc(card.title)}" title="Delete card">${icon('close')}</button>${meta}</article>`;
  }
  function listMarkup(list) {
    const cards = list.cards.filter(card => !card.archived && card.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const empty = searchTerm ? 'No matching cards' : 'No cards yet';
    return `<section class="list" data-list-id="${list.id}"><div class="list-head"><input class="list-title" value="${esc(list.title)}" aria-label="List title" /><button class="list-menu" type="button" data-action="delete-list" aria-label="Delete ${esc(list.title)}" title="Delete list">${icon('more')}</button></div><div class="cards" aria-label="Cards in ${esc(list.title)}">${cards.length ? cards.map(cardMarkup).join('') : `<p class="empty">${empty}</p>`}</div><div class="composer" hidden><textarea placeholder="Enter a title for this card…" aria-label="New card title"></textarea><div class="composer-actions"><button class="button button-primary" type="button" data-action="save-card">Add card</button><button class="composer-cancel" type="button" data-action="cancel-card" aria-label="Cancel adding card">${icon('close')}</button></div></div><button class="add-card" type="button" data-action="open-composer">${icon('plus')}Add a card</button></section>`;
  }
  function render() {
    const board = activeBoard();
    $('#board-title').value = board.title;
    $('#board').innerHTML = board.lists.filter(list => !list.archived).map(listMarkup).join('') + `<button id="add-list" class="add-list" type="button">${icon('plus')}Add another list</button>`;
    const count = board.lists.flatMap(list => list.cards).filter(card => !card.archived && card.title.toLowerCase().includes(searchTerm.toLowerCase())).length;
    const counter = $('#search-count');
    counter.textContent = searchTerm ? `${count} ${count === 1 ? 'card' : 'cards'} found` : '';
    $('#clear-search').hidden = !searchTerm;
  }

  function openComposer(listElement) { const composer = $('.composer', listElement); composer.hidden = false; $('.add-card', listElement).hidden = true; $('textarea', composer).focus(); }
  function closeComposer(listElement) { const composer = $('.composer', listElement); composer.hidden = true; $('.add-card', listElement).hidden = false; $('textarea', composer).value = ''; }
  function addCard(listElement) { const title = $('textarea', listElement).value.trim(); if (!title) { $('textarea', listElement).focus(); return; } mutate('Card added', () => findList(listElement.dataset.listId).cards.push(makeCard(title))); }
  function requestConfirmation(title, message, confirmLabel, action) { pendingAction = action; $('#confirm-title').textContent = title; $('#confirm-message').textContent = message; $('#confirm-action').textContent = confirmLabel; $('#confirm-dialog').showModal(); }

  function handleBoardClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    const listElement = event.target.closest('.list');
    if (action === 'open-composer') openComposer(listElement);
    if (action === 'cancel-card') closeComposer(listElement);
    if (action === 'save-card') addCard(listElement);
    if (action === 'delete-card') {
      const cardElement = event.target.closest('.card');
      const found = findCard(cardElement.dataset.cardId);
      requestConfirmation('Delete this card?', `“${found.card.title}” will be permanently removed from this local board.`, 'Delete card', () => mutate('Card deleted', () => { found.list.cards = found.list.cards.filter(card => card.id !== found.card.id); }));
    }
    if (action === 'delete-list') {
      const list = findList(listElement.dataset.listId);
      requestConfirmation('Delete this list?', `“${list.title}” and its ${list.cards.length} card${list.cards.length === 1 ? '' : 's'} will be permanently removed.`, 'Delete list', () => mutate('List deleted', () => { activeBoard().lists = activeBoard().lists.filter(item => item.id !== list.id); }));
    }
  }

  $('#board').addEventListener('click', handleBoardClick);
  $('#board').addEventListener('change', event => {
    if (!event.target.matches('.list-title')) return;
    const list = findList(event.target.closest('.list').dataset.listId);
    const nextTitle = event.target.value.trim() || 'Untitled list';
    if (nextTitle !== list.title) mutate('List renamed', () => { list.title = nextTitle; list.updatedAt = now(); });
  });
  $('#board').addEventListener('keydown', event => {
    if (event.target.matches('.composer textarea')) {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); addCard(event.target.closest('.list')); }
      if (event.key === 'Escape') closeComposer(event.target.closest('.list'));
    }
  });
  $('#board').addEventListener('dragstart', event => { const card = event.target.closest('.card'); if (!card) return; draggedCardId = card.dataset.cardId; card.classList.add('dragging'); event.dataTransfer.effectAllowed = 'move'; });
  $('#board').addEventListener('dragend', event => { event.target.closest('.card')?.classList.remove('dragging'); document.querySelectorAll('.drop-target').forEach(item => item.classList.remove('drop-target')); draggedCardId = null; });
  $('#board').addEventListener('dragover', event => { const cards = event.target.closest('.cards'); if (!cards || !draggedCardId) return; event.preventDefault(); cards.closest('.list').classList.add('drop-target'); event.dataTransfer.dropEffect = 'move'; });
  $('#board').addEventListener('dragleave', event => event.target.closest('.list')?.classList.remove('drop-target'));
  $('#board').addEventListener('drop', event => {
    const listElement = event.target.closest('.list'); if (!listElement || !draggedCardId) return; event.preventDefault();
    const found = findCard(draggedCardId); const destination = findList(listElement.dataset.listId); if (!found || !destination) return;
    mutate('Card moved', () => { found.list.cards = found.list.cards.filter(card => card.id !== found.card.id); destination.cards.push(found.card); });
  });

  document.addEventListener('click', event => {
    if (event.target.closest('#add-list')) { mutate('New list added', () => activeBoard().lists.push(makeList('New list'))); requestAnimationFrame(() => $('#board .list:last-of-type .list-title')?.focus()); }
    if (event.target.closest('#theme-toggle')) { state.preferences.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; persist(); applyTheme(); say(`${state.preferences.theme === 'dark' ? 'Dark' : 'Light'} theme enabled`); }
    if (event.target.closest('#board-menu')) { const panel = $('#board-menu-panel'); const open = panel.hidden; panel.hidden = !open; $('#board-menu').setAttribute('aria-expanded', String(open)); }
    if (event.target.closest('[data-action="reset-board"]')) { $('#board-menu-panel').hidden = true; $('#board-menu').setAttribute('aria-expanded', 'false'); requestConfirmation('Reset this board?', 'All lists and cards will be replaced with the original sample board.', 'Reset board', () => { const replacement = makeSeedBoard(); replacement.id = activeBoard().id; replacement.title = activeBoard().title; mutate('Board reset', () => { state.boards = [replacement]; state.activeBoardId = replacement.id; }); }); }
    if (!event.target.closest('.board-actions')) { $('#board-menu-panel').hidden = true; $('#board-menu').setAttribute('aria-expanded', 'false'); }
  });
  $('#board-title').addEventListener('change', event => { const title = event.target.value.trim() || 'Untitled board'; if (title !== activeBoard().title) mutate('Board renamed', () => { activeBoard().title = title; document.title = `${title} — Flowboard`; }); });
  $('#search').addEventListener('input', event => { searchTerm = event.target.value.trim(); render(); });
  $('#clear-search').addEventListener('click', () => { $('#search').value = ''; searchTerm = ''; render(); $('#search').focus(); });
  $('#confirm-dialog').addEventListener('close', () => { if ($('#confirm-dialog').returnValue === 'confirm' && pendingAction) pendingAction(); pendingAction = null; });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (state.preferences.theme === 'system') applyTheme(); });

  state = loadState();
  applyTheme();
  render();
  if (!storageAvailable) say('Local storage is unavailable. Changes may not persist.');
})();
