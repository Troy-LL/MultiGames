import { test, expect, type Browser } from '@playwright/test';

async function openToBoard(browser: Browser, room: string, name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/?room=${room}`);
  await page.locator('button.sudoku-choice').click();
  await page.locator('#name-input').fill(name);
  await page.locator('button.join-btn').click();
  return { ctx, page };
}

// Race 1: K players hit ONE brand-new room simultaneously.
test('race: simultaneous creation of one fresh room', async ({ browser }) => {
  const room = 'race-simul';
  const K = 4;
  const sessions = await Promise.all(
    Array.from({ length: K }, (_, i) => openToBoard(browser, room, `U${i}`)),
  );
  try {
    for (const { page } of sessions) {
      await expect(page.locator('[role="grid"][aria-label="Sudoku board"]')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('button[role="gridcell"][aria-label*="clue"]').first()).toBeVisible({ timeout: 10_000 });
    }
    // All should converge to K players in the roster.
    for (const { page } of sessions) {
      await expect(page.locator('section[aria-label="Players online"] li.player-row')).toHaveCount(K, { timeout: 10_000 });
    }
  } finally {
    await Promise.all(sessions.map((s) => s.ctx.close()));
  }
});

// Race 2: rapid reload of the same room (reconnect churn).
test('race: rapid reconnect keeps the board populated', async ({ browser }) => {
  const room = 'race-reconnect';
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    for (let i = 0; i < 5; i++) {
      await page.goto(`/?room=${room}`);
      await page.locator('button.sudoku-choice').click();
      if (await page.locator('#name-input').count()) {
        await page.locator('#name-input').fill('Rick');
        await page.locator('button.join-btn').click();
      }
      await expect(page.locator('[role="grid"][aria-label="Sudoku board"]')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('button[role="gridcell"][aria-label*="clue"]').first()).toBeVisible({ timeout: 10_000 });
    }
  } finally {
    await ctx.close();
  }
});
