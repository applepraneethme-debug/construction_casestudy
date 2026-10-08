import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration with backend API proxy setup
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
});
