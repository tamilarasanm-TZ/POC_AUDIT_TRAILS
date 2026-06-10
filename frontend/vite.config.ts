import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
        // Forward the original client IP so the backend logs the real LAN IP
        // instead of "localhost (the proxy itself)". This mirrors how nginx /
        // a real reverse proxy would behave in production.
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            const realIp =
              (req.headers['x-forwarded-for'] as string) ||
              req.socket?.remoteAddress ||
              '';
            if (realIp) proxyReq.setHeader('x-forwarded-for', realIp);
          });
        },
      },
    },
  },
});
