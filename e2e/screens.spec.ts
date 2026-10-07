import { test, expect, type Page } from '@playwright/test';

const shot = (name: string) => `docs/loop/shots/${name}.png`;

async function joinSudoku(page: Page, room: string, name: string) {
  await page.goto(`/?room=${room}`);
  // Landing: "Choose your game"
  await expect(page.getByRole('heading', { name: 'Choose your game' })).toBeVisible();
  await page.locator('button.sudoku-choice').click();
  // Join screen
  await page.locator('#name-input').fill(name);
  await page.locator('button.join-btn').click();
  // Board
  await expect(page.locator('[role="grid"][aria-label="Sudoku board"]')).toBeVisible();
}

test('solo: capture landing, join, sudoku board', async ({ page }) => {
  await page.goto('/?room=looptest');
  await expect(page.getByRole('heading', { name: 'Choose your game' })).toBeVisible();
  await page.screenshot({ path: shot('01-landing'), fullPage: true });

  await page.locator('button.sudoku-choice').click();
  await expect(page.locator('#name-input')).toBeVisible();
  await page.locator('#name-input').fill('Alice');
  await page.screenshot({ path: shot('02-join'), fullPage: true });

  await page.locator('button.join-btn').click();
  await expect(page.locator('[role="grid"][aria-label="Sudoku board"]')).toBeVisible();
  // wait for online sync so the board has values
  await expect(page.locator('.status-text')).toHaveText(/Connected|Offline/, { timeout: 10_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot('03-sudoku-board'), fullPage: true });
});

test('resilience: stalled connection surfaces a Retry instead of hanging', async ({ page }) => {
  // Simulate a server that accepts the socket but never sends a snapshot
  // (dead host / dropped init / cold server). The client should stop hanging.
  await page.routeWebSocket(/:1999/, () => {
    // Accept the client socket; never connect upstream, never reply.
  });
  await page.goto('/?room=deadserver');
  await page.locator('button.sudoku-choice').click();
  await page.locator('#name-input').fill('Zoe');
  await page.locator('button.join-btn').click();

  const alert = page.getByRole('alert').filter({ hasText: /Can.t reach the game server/i });
  await expect(alert).toBeVisible({ timeout: 12_000 });
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await page.screenshot({ path: shot('07-connection-trouble'), fullPage: true });
});

test('wordle: clicking the active mode does not wipe the board', async ({ page }) => {
  await page.goto('/?room=loopwordle');
  await page.locator('button.wordle-choice').click();
  await page.locator('#name-input').fill('Wanda');
  await page.locator('button.join-btn').click();
  await expect(page.getByRole('section', { name: 'Wordle game' }).or(page.locator('.wordle-game'))).toBeVisible();
  await expect(page.locator('.status-text')).toHaveText(/Connected|Offline/, { timeout: 10_000 });

  // Submit one guess (any 5 letters; server accepts /^[a-z]{5}$/).
  await page.keyboard.type('crane');
  await page.keyboard.press('Enter');
  const standing = page.locator('.standings-list .standing-row').first();
  await expect(standing).toContainText('1/6', { timeout: 10_000 });

  await page.screenshot({ path: shot('06-wordle-after-guess'), fullPage: true });

  // Click the ALREADY-ACTIVE mode (Race default). Must NOT reset progress.
  const activeMode = page.locator('.wordle-mode button[aria-pressed="true"]');
  await activeMode.click();
  await page.waitForTimeout(800);
  await expect(standing).toContainText('1/6');
});

test('multiplayer: two sessions share one sudoku board', async ({ browser }) => {
  const room = 'loopsync';
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await joinSudoku(a, room, 'Alice');
  await joinSudoku(b, room, 'Bob');

  // A picks the first empty, non-given cell and fills 5.
  const emptyCell = a.locator('button[role="gridcell"][aria-label*="empty"]').first();
  const label = await emptyCell.getAttribute('aria-label');
  const m = label!.match(/Row (\d+), column (\d+)/)!;
  const rc = `Row ${m[1]}, column ${m[2]}`;
  await emptyCell.click();
  await a.locator('[aria-label="Number input"] button', { hasText: /^5$/ }).click();

  // B sees the same cell become 5 (broadcast round-trip).
  // aria-label carries the value; visible text may also include a presence badge.
  const bCell = b.locator(`button[role="gridcell"][aria-label="${rc}, 5"]`);
  await expect(bCell).toBeVisible({ timeout: 10_000 });

  await a.screenshot({ path: shot('04-mp-sessionA'), fullPage: true });
  await b.screenshot({ path: shot('05-mp-sessionB'), fullPage: true });

  await ctxA.close();
  await ctxB.close();
});
