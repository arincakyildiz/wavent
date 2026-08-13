import { expect, Page, test } from '@playwright/test';

async function loadSampleData(page: Page): Promise<void> {
  await page.locator('.topbar').getByRole('button', { name: 'Örnek verileri yükle' }).click();
  await expect(page.getByText('Örnek veriler yüklendi')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Depo Yöneticisi/ }).click();
  await expect(page).toHaveURL(/\/wms\/overview/);
});

test('switches language without reloading the application', async ({ page }) => {
  await page.getByRole('button', { name: 'EN', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('starts empty and persists the sample dataset after loading it', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Henüz depo verisi bulunmuyor' })).toBeVisible();
  await loadSampleData(page);
  await page.reload();
  await page.getByRole('button', { name: /Depo Yöneticisi/ }).click();
  await expect(page).toHaveURL(/\/wms\/overview/);

  await expect(page.getByRole('heading', { name: 'Henüz depo verisi bulunmuyor' })).toHaveCount(0);
  await expect(page.getByText('Depo Bazında Envanter')).toBeVisible();
});

test('opens the notification center and keeps recent notifications', async ({ page }) => {
  await loadSampleData(page);
  await page.getByRole('button', { name: 'Bildirimler' }).click();

  const panel = page.getByRole('dialog', { name: 'Bildirimler' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Örnek veriler yüklendi')).toBeVisible();
  await panel.getByRole('button', { name: 'Tümünü temizle' }).click();
  await expect(panel.getByText('Henüz bildirim yok')).toBeVisible();
});

test('shows a newly created warehouse in the list and global scope', async ({ page }) => {
  await page.getByRole('link', { name: 'Depolar', exact: true }).click();
  await page.getByRole('button', { name: 'Depo Ekle' }).click();
  await page.getByRole('textbox', { name: 'Depo Kodu' }).fill('ANK-01');
  await page.getByRole('textbox', { name: 'Depo Adı' }).fill('Ankara Dağıtım Merkezi');
  await page.getByRole('textbox', { name: 'Şehir' }).fill('Ankara');
  await page.getByRole('textbox', { name: 'Ülke' }).fill('Türkiye');
  await page.getByRole('button', { name: 'Depoyu Oluştur' }).click();

  await expect(page.getByRole('cell', { name: 'ANK-01' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Ankara Dağıtım Merkezi' })).toBeVisible();
  await page.getByRole('button', { name: /Depo kapsamı/ }).click();
  await expect(page.getByRole('menuitem', { name: /ANK-01.*Ankara Dağıtım Merkezi/ })).toBeVisible();
});

test('clears the sample dataset from settings after confirmation', async ({ page }) => {
  await loadSampleData(page);
  await page.getByRole('link', { name: 'Ayarlar' }).click();
  await page.getByRole('button', { name: 'Tüm verileri temizle' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Tüm verileri temizle' }).click();

  await expect(page).toHaveURL(/\/wms\/overview/);
  await expect(page.getByRole('heading', { name: 'Henüz depo verisi bulunmuyor' })).toBeVisible();
});

test('completes a justified putaway capacity override', async ({ page }) => {
  await loadSampleData(page);
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

test('executes a pick task from the virtual task list', async ({ page }) => {
  await loadSampleData(page);
  await page.getByRole('link', { name: 'Toplama', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Toplama Görevleri' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Durum filtresi' }).selectOption('in-progress');
  const taskRow = page.locator('.task-vtable__row').filter({ has: page.getByRole('button', { name: 'Rotayı Gör' }) }).first();
  await expect(taskRow).toBeVisible();
  await taskRow.getByRole('button', { name: 'Rotayı Gör' }).click();
  const detail = page.locator('.task-detail');
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: 'Görev ata' }).click();
  await expect(page.getByText('Görev atandı')).toBeVisible();
});

test('records a cycle count and requests the mandatory recount', async ({ page }) => {
  await loadSampleData(page);
  await page.getByRole('link', { name: 'Sayımlar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sayımlar' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Durum filtresi' }).selectOption('scheduled');
  const enterButton = page.getByRole('button', { name: 'Sayım gir' }).first();
  await expect(enterButton).toBeVisible();
  await enterButton.click();
  await page.getByRole('spinbutton', { name: 'Sayılan miktar' }).fill('0');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByText('İkinci sayım zorunlu')).toBeVisible();
});

test('creates a managed hierarchy location', async ({ page }) => {
  await loadSampleData(page);
  await page.getByRole('link', { name: 'Lokasyonlar', exact: true }).click();
  await page.getByRole('button', { name: 'Yeni lokasyon' }).click();
  await page.getByRole('textbox', { name: 'Üst lokasyon yolu' }).fill('E2E');
  await page.getByRole('textbox', { name: 'Lokasyon kodu' }).fill('BIN-01');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByText('Lokasyon oluşturuldu')).toBeVisible();
});
