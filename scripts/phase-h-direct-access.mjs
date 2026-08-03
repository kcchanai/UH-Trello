#!/usr/bin/env node

/**
 * Phase H direct Firestore probe.
 *
 * Read-only by design. It performs authenticated reads and intentionally
 * unauthorized/stale writes, then prints only HTTP status classifications.
 * It never prints, stores, or includes the bearer token in an error message.
 *
 * Required environment variables:
 *   FLOWBOARD_ACCESS_TOKEN       Firebase ID token for the account under test
 *   FLOWBOARD_WORKSPACE_ID       workspace to inspect
 *   FLOWBOARD_BOARD_ID           board to inspect
 *   FLOWBOARD_CARD_ID            card to inspect
 *
 * Optional:
 *   FLOWBOARD_PROJECT_ID         defaults to flowboard-504105
 *   FLOWBOARD_TAMPER_WORKSPACE_ID a different workspace ID for isolation testing
 *
 * Example:
 *   FLOWBOARD_ACCESS_TOKEN='[local only]' \
 *   FLOWBOARD_WORKSPACE_ID='...' \
 *   FLOWBOARD_BOARD_ID='...' \
 *   FLOWBOARD_CARD_ID='...' \
 *   node scripts/phase-h-direct-access.mjs
 */

const projectId = process.env.FLOWBOARD_PROJECT_ID || 'flowboard-504105';
const token = process.env.FLOWBOARD_ACCESS_TOKEN;
const workspaceId = process.env.FLOWBOARD_WORKSPACE_ID;
const boardId = process.env.FLOWBOARD_BOARD_ID;
const cardId = process.env.FLOWBOARD_CARD_ID;
const tamperWorkspaceId = process.env.FLOWBOARD_TAMPER_WORKSPACE_ID;

if (!token || !workspaceId || !boardId || !cardId) {
  console.error('Missing required Phase H variables. Token value is intentionally not displayed.');
  process.exitCode = 2;
  process.exit();
}

const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
const path = (...parts) => parts.map(part => encodeURIComponent(part)).join('/');
const headers = {authorization: `Bearer ${token}`, accept: 'application/json'};

async function call(method, url, body) {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? {...headers, 'content-type': 'application/json'} : headers,
      body: body ? JSON.stringify(body) : undefined
    });
    return {status: response.status, ok: response.ok};
  } catch {
    return {status: 0, ok: false, networkError: true};
  }
}

function classify(result, expected) {
  if (result.networkError) return 'network-error';
  if (result.status === expected) return 'pass';
  return `unexpected-${result.status}`;
}

const workspacePath = path('workspaces', workspaceId);
const boardPath = path('workspaces', workspaceId, 'boards', boardId);
const cardPath = path('workspaces', workspaceId, 'boards', boardId, 'cards', cardId);
const commentsPath = path('workspaces', workspaceId, 'boards', boardId, 'cards', cardId, 'comments');

const checks = [];
const add = async (name, method, url, expected, body) => {
  const result = await call(method, url, body);
  checks.push({name, expected, status:result.status, result:classify(result, expected)});
};

await add('member workspace read', 'GET', `${root}/${workspacePath}`, 200);
await add('member board read', 'GET', `${root}/${boardPath}`, 200);
await add('member card read', 'GET', `${root}/${cardPath}`, 200);
await add('bounded comment collection read', 'GET', `${root}/${commentsPath}?pageSize=25`, 200);

if (tamperWorkspaceId) {
  await add(
    'cross-workspace workspace read denied',
    'GET',
    `${root}/${path('workspaces', tamperWorkspaceId)}`,
    403
  );
}

const staleCardPatch = {
  fields: {title: {stringValue: 'Phase H direct-write denial probe'}}
};
const staleCardUrl = `${root}/${cardPath}?updateMask.fieldPaths=title`;
await add('direct stale card write denied', 'PATCH', staleCardUrl, 403, staleCardPatch);

const malformedComment = {
  fields: {
    authorUid: {stringValue: 'forged-author'},
    body: {stringValue: 'Phase H malformed direct write'},
    revision: {integerValue: '0'}
  }
};
await add('direct malformed comment write denied', 'POST', `${root}/${commentsPath}`, 403, malformedComment);

const summary = {
  project: projectId,
  workspace: workspaceId,
  board: boardId,
  card: cardId,
  checks,
  passed: checks.filter(check => check.result === 'pass').length,
  total: checks.length,
  note: 'HTTP statuses only. Access token and response bodies were not printed.'
};
console.log(JSON.stringify(summary, null, 2));
if (checks.some(check => check.result !== 'pass')) process.exitCode = 1;
