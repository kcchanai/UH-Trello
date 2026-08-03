#!/usr/bin/env node

/**
 * Phase H direct Firestore probe.
 *
 * Negative-write authorization probe. It performs authenticated or anonymous reads
 * plus intentionally invalid/stale writes that production Rules must deny, then
 * prints only HTTP status classifications. Run it only against a dedicated test
 * target because a misconfigured Rules deployment could make a negative write
 * unexpectedly succeed.
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
 *   FLOWBOARD_ANONYMOUS          set to YES to omit authentication and expect denial
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
const anonymous = process.env.FLOWBOARD_ANONYMOUS === 'YES';

if ((!token && !anonymous) || !workspaceId || !boardId || !cardId) {
  console.error('Missing required Phase H variables. Token value is intentionally not displayed.');
  process.exitCode = 2;
  process.exit();
}

const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
const path = (...parts) => parts.map(part => encodeURIComponent(part)).join('/');
const headers = {
  ...(anonymous ? {} : {authorization: `Bearer ${token}`}),
  accept: 'application/json'
};

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

const allowedReadStatus = anonymous ? 403 : 200;
await add('workspace read', 'GET', `${root}/${workspacePath}`, allowedReadStatus);
await add('board read', 'GET', `${root}/${boardPath}`, allowedReadStatus);
await add('card read', 'GET', `${root}/${cardPath}`, allowedReadStatus);
await add('bounded comment collection read', 'GET', `${root}/${commentsPath}?pageSize=25`, allowedReadStatus);
await add('over-limit comment collection read denied', 'GET', `${root}/${commentsPath}?pageSize=26`, 403);
await add('unbounded comment collection read denied', 'GET', `${root}/${commentsPath}`, 403);

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
  mode: anonymous ? 'anonymous' : 'authenticated-member',
  target: 'redacted',
  checks,
  passed: checks.filter(check => check.result === 'pass').length,
  total: checks.length,
  note: 'HTTP statuses only. Access token and response bodies were not printed.'
};
console.log(JSON.stringify(summary, null, 2));
if (checks.some(check => check.result !== 'pass')) process.exitCode = 1;
