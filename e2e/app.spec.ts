import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Depo Yöneticisi/ }).click();
  await expect(page).toHaveURL(/\/wms\/overview/);
});

test('switches language without reloading the application', async ({ page }) => {
  await page.getByRole('button', { name: 'EN', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('completes a justified putaway capacity override', async ({ page }) => {
  await page.getByRole('link', { name: 'Yerleştirme' }).click();
  await expect(page).toHaveURL(/\/wms\/putaway/);
  await page.getByRole('combobox', { name: 'Sayfa başına' }).selectOption('60');
  const violatingRow = page
    .locator('tbody tr')
    .filter({ hasText: 'Kısıt ihlali' })
    .filter({ has: page.getByRole('button', { name: 'Kabul Et' }) })
    .first();
  await expect(violatingRow).toBeVisible();

  await violatingRow.getByRole('button', { name: 'Kabul Et' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const reasonInput = dialog.getByRole('textbox');
  const confirmButton = dialog.getByRole('button', { name: 'Gerekçeyle kabul et' });
  await expect(reasonInput).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(reasonInput).toBeFocused();
  await reasonInput.fill('Vardiya lideri kapasite aşımını onayladı');
  await confirmButton.click();

  await expect(page.getByText('Yerleştirme kabul edildi')).toBeVisible();
});
