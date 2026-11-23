import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths so the built site works from a project subpath as
  // well as a domain root.
  base: './',
  build: { outDir: 'dist', sourcemap: true },
});
