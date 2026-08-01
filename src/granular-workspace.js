const clone = value => JSON.parse(JSON.stringify(value));
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 500 && !value.includes('/');
const byRank = (a, b) => (a.rank ?? 0) - (b.rank ?? 0) || String(a.id).localeCompare(String(b.id));

export function granularizeBoard(snapshot, rank) {
  const board = clone(snapshot);
  if (!validId(board?.id) || !Array.isArray(board.lists)) throw new Error('This cloud board cannot be migrated because its structure is invalid.');
  const listIds = new Set(), cardIds = new Set(), lists = [], cards = [];
  board.lists.forEach((list, listRank) => {
    if (!validId(list?.id) || listIds.has(list.id) || !Array.isArray(list.cards)) throw new Error('This cloud board has invalid or duplicate list identifiers.');
    listIds.add(list.id);
    const {cards: listCards, ...listData} = list;
    lists.push({id:list.id, rank:listRank, ...listData});
    listCards.forEach((card, cardRank) => {
      if (!validId(card?.id) || cardIds.has(card.id)) throw new Error('This cloud board has invalid or duplicate card identifiers.');
      cardIds.add(card.id);
      cards.push({id:card.id, listId:list.id, rank:cardRank, ...card});
    });
  });
  const {lists: ignored, ...metadata} = board;
  return {board:{id:board.id, rank, ...metadata}, lists, cards};
}

export function rehydrateGranularWorkspace(metadata, boardRecords) {
  const boards = boardRecords.map(record => {
    const lists = [...record.lists].sort(byRank).map(list => {
      const {id, rank, ...listData} = list;
      return {id, ...listData, cards:record.cards.filter(card => card.listId === id).sort(byRank).map(card => {
        const {listId, rank: cardRank, ...cardData} = card;
        return cardData;
      })};
    });
    const {id, rank, ...boardData} = record.board;
    return {id, ...boardData, lists};
  }).sort(byRank);
  return {...metadata, boards};
}
