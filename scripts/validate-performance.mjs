import {readFile, stat} from 'node:fs/promises';

const files = [
  'index.html', 'styles.css', 'state-core.js', 'app.js',
  'src/main.js', 'src/config.js',
  'src/auth-ui.js', 'src/adapters/adapter-contract.js', 'src/adapters/local-workspace-adapter.js',
  'src/adapters/firebase-workspace-adapter.js'
];
const limits = {
  'index.html': 20_000, 'styles.css': 40_000, 'state-core.js': 20_000, 'app.js': 80_000,
  'src/main.js': 8_000, 'src/config.js': 4_000,
  'src/auth-ui.js': 8_000, 'src/adapters/adapter-contract.js': 8_000,
  'src/adapters/local-workspace-adapter.js': 12_000, 'src/adapters/firebase-workspace-adapter.js': 8_000
};
let total = 0;
for (const file of files) {
  const bytes = (await stat(file)).size;
  total += bytes;
  if (bytes > limits[file]) throw new Error(`${file} is ${bytes} bytes; budget is ${limits[file]}.`);
}
if (total > 160_000) throw new Error(`Initial source assets are ${total} bytes; budget is 160000.`);
const html = await readFile('index.html', 'utf8');
if (!html.includes('/src/main.js')) throw new Error('Vite module application entry is not loaded.');
console.log(`Performance budgets passed: ${total} bytes across ${files.length} source assets (budget 160000).`);
