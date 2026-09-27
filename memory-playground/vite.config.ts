import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

// Local Node runtime: the Python Mem0 service owns persistent storage.
export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { host: '127.0.0.1', port: 3000, strictPort: true },
  plugins: [vinext()],
});
