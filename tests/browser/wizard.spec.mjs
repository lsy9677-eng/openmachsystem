import { test, expect } from '@playwright/test';
import { auditNetwork } from './network.mjs';
test('new tournament wizard creates a synthetic tournament in the Emulator', async({page,context})=>{
  const forbidden=await auditNetwork(context);
  await page.goto('/');
  await page.evaluate(()=>import('/assets/js/bootstrap.js'));
  await page.evaluate(async()=>{await (await import('/assets/js/auth-engine.js?v=3565')).signInGoogle();});
  await page.goto('/#tournaments');
  await page.evaluate(()=>import('/assets/js/bootstrap.js'));
  await expect(page.locator('body')).toHaveAttribute('data-role','admin');
  await page.waitForFunction(()=>typeof window.openNewTournamentWizard==='function');
  await page.locator('#createNewTournamentBtn').click({timeout:10000});
  await expect(page.locator('#newTournamentWizard')).toBeVisible();
  const name='[LOCAL] Wizard '+Date.now();
  await page.locator('#wizardTournamentName').fill(name);
  await page.locator('#wizardTournamentDate').fill('2026-11-01');
  await page.locator('#wizardTournamentVenue').fill('Synthetic court');
  for(let i=0;i<3;i++)await page.locator('#wizardNextBtn').click();
  await page.locator('#wizardConfirmChecked').check();
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#wizardCreateBtn').click();
  await expect.poll(async()=>page.evaluate(async name=>{
    const rt=await (await import('/assets/js/auth-engine.js?v=3565')).getAuthRuntime();
    const snap=await rt.api.getDocs(rt.api.collection(rt.db,'matchRoomsV7','230match-development','tournaments'));
    return snap.docs.some(doc=>doc.data().name===name&&doc.data().workspaceChunks?.length>0);
  },name),{timeout:20000}).toBe(true);
  expect(forbidden).toEqual([]);
});
