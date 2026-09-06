import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-e2e-'));
const factoryDir = path.join(testDir, 'factory');
const repoDir = path.join(testDir, 'repo');
fs.mkdirSync(factoryDir);
fs.mkdirSync(repoDir);
const port = 8799;
process.env.WYLD_E2E_DEMOS_DIR = path.join(factoryDir, 'demos');

// Run `pnpm build` first: the smoke test deliberately exercises the built Pak and server.
const config = defineConfig({
  testDir: 'e2e',
  // The specs share one server and one database, so they must not interleave.
  fullyParallel: false,
  workers: 1,
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: 'node ../server/dist/main.js',
    env: {
      FACTORY_DIR: factoryDir,
      REPO_DIR: repoDir,
      PAK_PORT: String(port),
      PAK_DIST: path.resolve('dist'),
      WAKE_URL: '',
      WAKE_SECRET: '',
      SLEEP_SCHEDULE: 'off',
    },
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
  },
  use: { baseURL: `http://localhost:${port}` },
});

export { config as default };
