import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';
export default defineConfig({
  ...base,
  use:{...base.use,baseURL:'http://127.0.0.1:8788'},
  webServer:{command:'node tools/pages-local.mjs',url:'http://127.0.0.1:8788',reuseExistingServer:false,timeout:30000}
});
