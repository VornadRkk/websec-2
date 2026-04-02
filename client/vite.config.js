import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = __dirname;

export default defineConfig(({ mode }) => {
  loadEnv(mode, process.cwd(), '');

  return {
    root: clientRoot,
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
    build: {
      outDir: path.resolve(clientRoot, 'dist'),
      emptyOutDir: true,
    },
  };
});
