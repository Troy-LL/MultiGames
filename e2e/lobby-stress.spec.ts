import { test, expect } from '@playwright/test';

// Reproduction harness for "lobby creation sometimes doesn't work".
// Opens N fresh rooms in fresh contexts; each must reach a real, populated
// sudoku board (grid + at least one given clue) within the timeout.
const N = 10;

test('stress: fresh lobby creation reaches a populated board every time', async ({ browser }) => {
  const failures: string[] = [];

  for (let i = 0; i < N; i++) {
    const room = `stress-${i}-${'x'.repeat(i % 3)}`; // vary label, no Date/random
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(`/?room=${room}`);
      await page.getByRole('heading', { name: 'Choose your game' }).waitFor({ timeout: 8000 });
      await page.locator('button.sudoku-choice').click();
      await page.locator('#name-input').fill(`P${i}`);
      await page.locator('button.join-btn').click();

      // Board must render...
      await page.locator('[role="grid"][aria-label="Sudoku board"]').waitFor({ timeout: 8000 });
      // ...and be populated (a real puzzle has given clues). "Loading game…" or
      // an all-empty board = lobby init failed.
      const givens = page.locator('button[role="gridcell"][aria-label*="clue"]');
      await expect(givens.first()).toBeVisible({ timeout: 8000 });
      const count = await givens.count();
      const status = await page.locator('.status-text').first().innerText().catch(() => '?');
      if (count < 10) failures.push(`${room}: only ${count} clues, status=${status}`);
    } catch (e) {
      const status = await page.locator('.status-text').first().innerText().catch(() => 'no-status');
      const loading = await page.locator('.loading').count().catch(() => -1);
      failures.push(`${room}: THREW status=${status} loadingEls=${loading} :: ${(e as Error).message.split('\n')[0]}`);
    } finally {
      await ctx.close();
    }
  }

  console.log(`lobby-stress: ${N - failures.length}/${N} ok`);
  if (failures.length) console.log('FAILURES:\n' + failures.join('\n'));
  expect(failures, `\n${failures.join('\n')}`).toHaveLength(0);
});
