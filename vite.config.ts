import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import memoryPlugin from './vite-memory-plugin';

export default defineConfig({
  plugins: [react(), memoryPlugin()],
  server: { host: '127.0.0.1', port: 5173 }
});
