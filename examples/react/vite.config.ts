import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'jarvis-embed': new URL('../../src/index.ts', import.meta.url).pathname,
    },
  },
  server: {
    port: 5501,
    fs: {
      allow: ['../..'],
    },
    proxy: {
      '/api': 'http://localhost:5500',
    },
  },
});
