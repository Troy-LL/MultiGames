import { test, expect } from '@playwright/test';

// Backlog: in-product room creation (previously rooms only via ?room=).
test('create room: naming a room updates the URL and reaches a board', async ({ page }) => {
  await page.goto('/?room=lobby');
  await expect(page.getByRole('heading', { name: 'Choose your game' })).toBeVisible();

  // The landing now offers a create/join affordance.
  await page.locator('#room-input').fill('My Cool Room!');
  await page.getByRole('button', { name: 'Create / Join' }).click();

  // Slugged into the URL, no reload needed.
  await expect(page).toHaveURL(/[?&]room=my-cool-room/);

  // And the room is joinable end-to-end.
  await page.locator('button.sudoku-choice').click();
  await page.locator('#name-input').fill('Ann');
  await page.locator('button.join-btn').click();
  await expect(page.locator('[role="grid"][aria-label="Sudoku board"]')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('.room-name')).toHaveText('my-cool-room');
});

test('create room: Random generates a distinct room', async ({ page }) => {
  await page.goto('/?room=lobby');
  await page.getByRole('button', { name: 'Random' }).click();
  await expect(page).toHaveURL(/[?&]room=room-[a-z0-9]+/);
});
