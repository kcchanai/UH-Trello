import {readFile} from 'node:fs/promises';

const [html, app, core] = await Promise.all(['index.html', 'app.js', 'state-core.js'].map(file => readFile(file, 'utf8')));
const required = [
  ['semantic main landmark', /<main\b/],
  ['primary heading', /<h1\b/],
  ['skip link', /href="#board"/],
  ['live status region', /role="status"/],
  ['native dialogs', /<dialog\b/],
  ['core state loaded before app', /state-core\.js[\s\S]*app\.js/],
];
for (const [label, pattern] of required) if (!pattern.test(html)) throw new Error(`Static validation failed: missing ${label}.`);
if (!app.includes('FlowboardState.cardMatches') || !app.includes('FlowboardState.csvForBoard')) throw new Error('App does not use tested state helpers.');
if (!core.includes('module.exports')) throw new Error('State helpers are not testable in Node.');
console.log(`Static validation passed: ${required.length} semantic/runtime guards.`);
