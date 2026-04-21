import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import memoryPlugin from './vite-memory-plugin';

export default defineConfig({
  plugins: [react(), memoryPlugin()],
  server: { port: 5173 }
});
