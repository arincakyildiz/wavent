import { chromium } from '@playwright/test';
import { mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve('docs/wavent-demo.webm');
const videoDir = resolve('tmp/demo-video');
await mkdir(videoDir, { recursive: true });
await mkdir(dirname(output), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const pause = (ms = 1400) => page.waitForTimeout(ms);

await page.goto('http://127.0.0.1:4200');
await page.getByRole('button', { name: /Depo Yöneticisi/ }).click();
await pause(2200);
await page.getByRole('link', { name: 'Dalgalar' }).click();
await pause();
await page.locator('tbody tr').first().click();
await pause(1800);
await page.getByRole('link', { name: 'Toplama' }).click();
await pause();
await page.locator('.task-vtable__row').first().getByRole('button').click();
await pause(1800);
await page.getByRole('link', { name: 'Kontrol Kulesi' }).click();
await pause(2400);
await page.getByRole('link', { name: 'Denetim Kaydı' }).click();
await pause(1800);
await page.getByRole('link', { name: 'Ayarlar' }).click();
await pause(1600);

// Show that the same session and navigation are narrowed by role capabilities.
await page.getByRole('radio', { name: /Depo Operatörü/ }).check();
await pause(1800);
await page.getByRole('radio', { name: /Depo Yöneticisi/ }).check();
await pause(1400);

// Force a write failure, then demonstrate the optimistic putaway rollback and retry toast.
await page.locator('#writeFail').fill('100');
await pause(900);
await page.getByRole('link', { name: 'Yerleştirme' }).click();
await pause(1800);
await page.getByRole('button', { name: 'Kabul Et' }).first().click();
const dialog = page.getByRole('dialog');
if (await dialog.isVisible({ timeout: 800 }).catch(() => false)) {
  await dialog.getByRole('textbox').fill('Demo kapasite override gerekçesi');
  await dialog.getByRole('button', { name: /kabul/i }).click();
}
await pause(2600);

// Leave the checked-in demo profile clean for anyone replaying the recording.
await page.getByRole('link', { name: 'Ayarlar' }).click();
await pause(1200);
await page.locator('#writeFail').fill('0');
await pause(900);

const video = page.video();
await context.close();
await browser.close();
if (!video) throw new Error('Playwright did not create a video');
await rename(await video.path(), output);
console.log(output);
