import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const pwaOptions = {
  registerType: 'autoUpdate',
  devOptions: { enabled: false },
  workbox: {
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/play\//, /^\/api\//],
    skipWaiting: true,
    clientsClaim: true,
  },
  manifest: {
    name: 'WYLD — Expansion Pak',
    short_name: 'Pak',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#282a36',
    theme_color: '#bd93f9',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  },
} satisfies Parameters<typeof VitePWA>[0];

const config = defineConfig({
  base: process.env.PAK_BASE ?? '/',
  plugins: [tailwindcss(), react(), VitePWA(pwaOptions)],
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
      '/play': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'vite.config.test.ts'],
    globals: false,
  },
});

export { config as default, pwaOptions };
