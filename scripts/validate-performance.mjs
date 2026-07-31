import {readFile, stat} from 'node:fs/promises';

const files = ['index.html', 'styles.css', 'state-core.js', 'app.js'];
const limits = { 'index.html': 20_000, 'styles.css': 40_000, 'state-core.js': 20_000, 'app.js': 80_000 };
let total = 0;
for (const file of files) {
  const bytes = (await stat(file)).size;
  total += bytes;
  if (bytes > limits[file]) throw new Error(`${file} is ${bytes} bytes; budget is ${limits[file]}.`);
}
if (total > 140_000) throw new Error(`Initial static assets are ${total} bytes; budget is 140000.`);
const html = await readFile('index.html', 'utf8');
if (!html.includes('state-core.js') || !html.includes('app.js')) throw new Error('Required application scripts are not loaded.');
console.log(`Performance budgets passed: ${total} bytes across ${files.length} initial assets (budget 140000).`);
