import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const config = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      workbox: {
        navigateFallback: '/index.html',
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'WYLD — Expansion Pak',
        short_name: 'Pak',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#14121f',
        theme_color: '#5f5aa2',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        proxyTimeout: 0,
        configure(proxy) {
          proxy.on('proxyRes', (proxyResponse) => {
            proxyResponse.headers['x-accel-buffering'] = 'no';
          });
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
  },
});

export { config as default };
