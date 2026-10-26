import { test, expect } from '@playwright/test';
import { auditNetwork } from './network.mjs';

test('development server refuses private files and encoded traversal',async({request})=>{
  for(const path of ['/.git/config','/.dev.vars','/functions/_lib/common.js','/node_modules/firebase-tools/package.json','/assets/js/..%2F..%2Fpackage.json']) {
    const response=await request.get(path);
    expect(response.status()).toBe(404);
  }
});

test('Emulators unavailable: stop before app initialization without production fallback', async ({ page, context }) => {
  const forbidden = await auditNetwork(context);
  // Can also run while emulators are up to simulate a mid-session network outage.
  if (!process.env.REAL_EMULATORS_OFF) await page.route(/http:\/\/127\.0\.0\.1:(9099|8080|9199)\//, route => route.abort());
  await page.goto('/');
  await expect(page.locator('#environment-error')).toContainText('Emulator');
  expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
  expect(forbidden).toEqual([]);
});

test('unknown hostname is rejected before any Firebase request', async ({page, context, baseURL}) => {
  const forbidden = [];
  await context.route('**/*', async route => {
    const url=new URL(route.request().url());
    if(url.hostname==='unapproved.test') {
      const local=new URL(url.pathname+url.search,baseURL).href;
      const response=await context.request.get(local);
      return route.fulfill({response});
    }
    forbidden.push(url.origin+url.pathname);return route.abort();
  });
  await page.goto('http://unapproved.test');
  await expect(page.locator('#environment-error')).toContainText('호스트');
  expect(forbidden).toEqual([]);
});
