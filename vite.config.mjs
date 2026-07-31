import {defineConfig} from 'vite';

export default defineConfig({
  base: '/UH-Trello/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022'
  }
});
