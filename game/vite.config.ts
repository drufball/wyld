import { defineConfig } from 'vitest/config';

const config = defineConfig({
  base: process.env.GAME_BASE ?? '/',
  define: {
    __GAME_VERSION__: JSON.stringify('0.0.0'),
  },
});

export { config as default };
