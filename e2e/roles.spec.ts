import { expect, Page, test } from '@playwright/test';

const roleCases = [
  {
    login: /Depo Operatörü/,
    visible: ['Genel Bakış', 'Envanter', 'Lot / Seri', 'Mal Kabul', 'Yerleştirme', 'Toplama', 'Paketleme', 'Sevkiyat', 'Sayımlar', 'İstisnalar'],
    hidden: ['Depolar', 'Lokasyonlar', 'Stok Hareketleri', 'Rezervasyonlar', 'Dalgalar', 'İzlenebilirlik', 'Kontrol Kulesi', 'Denetim Kaydı', 'Ayarlar'],
  },
  {
    login: /Vardiya Lideri/,
    visible: ['Genel Bakış', 'Depolar', 'Lokasyonlar', 'Envanter', 'Lot / Seri', 'Stok Hareketleri', 'Rezervasyonlar', 'Mal Kabul', 'Yerleştirme', 'Dalgalar', 'Toplama', 'Paketleme', 'Sevkiyat', 'Sayımlar', 'İstisnalar', 'İzlenebilirlik', 'Kontrol Kulesi'],
    hidden: ['Denetim Kaydı', 'Ayarlar'],
  },
  {
    login: /Stok Kontrol Uzmanı/,
    visible: ['Genel Bakış', 'Depolar', 'Lokasyonlar', 'Envanter', 'Lot / Seri', 'Stok Hareketleri', 'Rezervasyonlar', 'Mal Kabul', 'Yerleştirme', 'Dalgalar', 'Toplama', 'Paketleme', 'Sevkiyat', 'Sayımlar', 'İstisnalar', 'İzlenebilirlik', 'Kontrol Kulesi', 'Denetim Kaydı'],
    hidden: ['Ayarlar'],
  },
  {
    login: /Sevkiyat Uzmanı/,
    visible: ['Genel Bakış', 'Envanter', 'Rezervasyonlar', 'Dalgalar', 'Paketleme', 'Sevkiyat', 'İstisnalar', 'İzlenebilirlik', 'Kontrol Kulesi'],
    hidden: ['Depolar', 'Lokasyonlar', 'Lot / Seri', 'Stok Hareketleri', 'Mal Kabul', 'Yerleştirme', 'Toplama', 'Sayımlar', 'Denetim Kaydı', 'Ayarlar'],
  },
  {
    login: /Planlama Uzmanı/,
    visible: ['Genel Bakış', 'Depolar', 'Lokasyonlar', 'Envanter', 'Rezervasyonlar', 'Dalgalar', 'Toplama', 'Sevkiyat', 'İzlenebilirlik', 'Kontrol Kulesi'],
    hidden: ['Lot / Seri', 'Stok Hareketleri', 'Mal Kabul', 'Yerleştirme', 'Paketleme', 'Sayımlar', 'İstisnalar', 'Denetim Kaydı', 'Ayarlar'],
  },
  {
    login: /Depo Yöneticisi/,
    visible: ['Genel Bakış', 'Depolar', 'Lokasyonlar', 'Envanter', 'Lot / Seri', 'Stok Hareketleri', 'Rezervasyonlar', 'Mal Kabul', 'Yerleştirme', 'Dalgalar', 'Toplama', 'Paketleme', 'Sevkiyat', 'Sayımlar', 'İstisnalar', 'İzlenebilirlik', 'Kontrol Kulesi', 'Denetim Kaydı', 'Ayarlar'],
    hidden: [],
  },
] as const;

async function signIn(page: Page, role: RegExp): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: role }).click();
  await expect(page).toHaveURL(/\/wms\/overview/);
}

for (const role of roleCases) {
  test(`shows the correct navigation for ${role.login.source}`, async ({ page }) => {
    await signIn(page, role.login);
    const nav = page.locator('nav.nav');
    for (const label of role.visible) await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
    for (const label of role.hidden) await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);

    if (role.hidden.some((label) => label === 'Ayarlar')) {
      await page.goto('/wms/settings');
      await expect(page.getByRole('heading', { name: '403 — Yetkiniz yok' })).toBeVisible();
    }
  });
}

test('limits write controls independently from screen visibility', async ({ page }) => {
  await signIn(page, /Stok Kontrol Uzmanı/);
  await page.locator('.topbar').getByRole('button', { name: 'Örnek verileri yükle' }).click();
  await page.getByRole('link', { name: 'Paketleme', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tart' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Lot / Seri', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Seri Kaydı Ekle' })).toBeVisible();
});
