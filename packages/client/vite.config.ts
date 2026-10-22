import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Si el 3000 está ocupado, fallar en vez de saltar al 3001 (puerto del backend: el proxy se llamaría a sí mismo)
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.WORDSMITH_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
