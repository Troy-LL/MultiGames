import { test, expect } from '@playwright/test';

// Backlog: numpad looked dead before a cell is selected. It should read as
// "waiting for input", not broken.
test('numpad: shows a hint while disabled, enables after selecting a cell', async ({ page }) => {
  await page.goto('/?room=numpad-hint');
  await page.locator('button.sudoku-choice').click();
  await page.locator('#name-input').fill('Nia');
  await page.locator('button.join-btn').click();
  await expect(page.locator('[role="grid"][aria-label="Sudoku board"]')).toBeVisible({
    timeout: 10_000,
  });

  // Pre-selection: hint visible, buttons disabled.
  await expect(page.locator('.numpad-hint')).toBeVisible();
  await expect(page.locator('.numpad-btn').first()).toBeDisabled();

  // Select an editable (non-clue) cell.
  await page
    .locator('button[role="gridcell"]:not([aria-label*="clue"])')
    .first()
    .click();

  // Hint gone, buttons live.
  await expect(page.locator('.numpad-hint')).toHaveCount(0);
  await expect(page.locator('.numpad-btn').first()).toBeEnabled();
});
