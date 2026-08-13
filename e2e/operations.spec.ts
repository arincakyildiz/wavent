import { expect, Page, test } from '@playwright/test';

async function startWithSampleData(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /Depo Yöneticisi/ }).click();
  await page.locator('.topbar').getByRole('button', { name: 'Örnek verileri yükle' }).click();
  await expect(page.getByText('Örnek veriler yüklendi')).toBeVisible();
}

test('registers a serialised stock unit and persists it', async ({ page }) => {
  await startWithSampleData(page);
  await page.getByRole('link', { name: 'Lot / Seri', exact: true }).click();
  await page.getByRole('button', { name: 'Seri Kaydı Ekle' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: /Seri No/ }).fill('E2E-SERIAL-2026-01');
  await dialog.getByRole('textbox', { name: /Seri No/ }).blur();
  await expect(dialog.getByRole('button', { name: 'Seriyi Kaydet' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Seriyi Kaydet' }).click();

  await expect(dialog).toBeHidden();
  await page.getByRole('searchbox', { name: 'Lot ara' }).fill('E2E-SERIAL-2026-01');
  await expect(page.getByRole('cell', { name: 'E2E-SERIAL-2026-01' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('cell', { name: 'E2E-SERIAL-2026-01' })).toBeVisible();
});

test('creates and processes an ASN exactly once', async ({ page }) => {
  await startWithSampleData(page);
  await page.getByRole('link', { name: 'Mal Kabul', exact: true }).click();
  await page.getByRole('button', { name: 'Yeni ASN' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: /ASN No/ }).fill('ASN-9901');
  await dialog.getByRole('spinbutton', { name: 'Beklenen miktar' }).fill('12');
  const lot = dialog.getByRole('textbox', { name: 'Lot' });
  if (await lot.count()) await lot.fill('LOT-E2E-01');
  await dialog.getByRole('button', { name: 'ASN Oluştur' }).click();

  await expect(page.getByRole('cell', { name: 'ASN-9901' })).toBeVisible();
  await page.getByRole('link', { name: 'ASN-9901 detayını aç' }).click();
  await expect(page.getByRole('heading', { name: 'ASN-9901' })).toBeVisible();
  await page.getByRole('table').getByRole('button', { name: 'Kabul işle' }).click();
  await page.getByRole('spinbutton', { name: 'Alınan' }).fill('12');
  await page.locator('form.operation-form').getByRole('button', { name: 'Kabul işle' }).click();

  await expect(page.getByText('Kabul satırı kaydedildi')).toBeVisible();
  await expect(page.getByText('İşlendi')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kabul işle' })).toHaveCount(0);
});
