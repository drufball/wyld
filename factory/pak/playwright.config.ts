import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const factoryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-e2e-'));

// Run `pnpm build` first: the smoke test deliberately exercises the built Pak and server.
const config = defineConfig({
  testDir: 'e2e',
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: 'node ../server/dist/main.js',
    env: { FACTORY_DIR: factoryDir, PAK_PORT: '8788', PAK_DIST: path.resolve('dist') },
    url: 'http://localhost:8788/api/health',
    reuseExistingServer: false,
  },
  use: { baseURL: 'http://localhost:8788' },
});

export { config as default };
