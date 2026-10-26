import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 90000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8000', headless: true },
  webServer: { command: 'node tools/dev-server.mjs', url: 'http://127.0.0.1:8000', reuseExistingServer: true },
  reporter: 'list'
});
