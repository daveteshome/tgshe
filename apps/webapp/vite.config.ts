import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const allowedHosts = [
  'localhost',
  '127.0.0.1',
  'd0831ecc8026.ngrok-free.app',
];

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts,
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  },
});