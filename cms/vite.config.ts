/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/shows': 'http://localhost:8000',
      '/seasons': 'http://localhost:8000',
      '/episodes': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
      '/catalog': 'http://localhost:8000',
      '/artwork': 'http://localhost:8000',
      '/storage': 'http://localhost:8000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
  },
});
