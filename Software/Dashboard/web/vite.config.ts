import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const isElectron = process.env.ELECTRON === 'true';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Must be top-level. `build.base` is ignored by Vite and produces a blank Electron window.
  base: isElectron ? './' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 4234,
    host: '127.0.0.1',
    strictPort: true,
    proxy: isElectron
      ? undefined // No proxy in Electron, direct connection
      : {
          '/api': {
            target: 'http://127.0.0.1:4123',
            changeOrigin: true,
          },
          '/socket.io': {
            target: 'http://127.0.0.1:4123',
            ws: true,
          },
        },
  },
  build: {
    outDir: 'dist',
  },
  define: {
    'import.meta.env.ELECTRON': JSON.stringify(isElectron),
  },
});
