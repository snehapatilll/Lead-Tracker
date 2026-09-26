import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React dev server runs on 5173 and proxies /api to the
// Express server on 3000. In production Express serves the built assets
// directly, so no proxy is involved.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
