import { test } from '@playwright/test';

const shot = (name: string) => `docs/loop/shots/${name}.png`;

test('ux: desktop cards flow', async ({ page }) => {
  await page.goto('/?room=uxcards');
  await page.locator('button.cards-choice').first().click(); // "She's a 2" on landing
  await page.screenshot({ path: shot('ux-cards-mode'), fullPage: true });
  // Pass & play (local, no server needed)
  await page.locator('button.cards-mode-local').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot('ux-cards-local-setup'), fullPage: true });
});

test('ux: mobile landing + board', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/?room=uxmobile');
  await page.getByRole('heading', { name: 'Choose your game' }).waitFor();
  await page.screenshot({ path: shot('ux-mobile-landing'), fullPage: true });

  await page.locator('button.sudoku-choice').click();
  await page.locator('#name-input').fill('Mia');
  await page.screenshot({ path: shot('ux-mobile-join'), fullPage: true });
  await page.locator('button.join-btn').click();
  await page.locator('[role="grid"][aria-label="Sudoku board"]').waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('ux-mobile-board'), fullPage: true });
  await ctx.close();
});
