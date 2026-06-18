import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });

await page.goto(BASE + '/');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/hmpp-lobby.png' });

await page.getByRole('button', { name: /create a room/i }).click();
await page.waitForURL(/\/room\//);
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/hmpp-join.png' });

await page.getByRole('button', { name: 'Vote', exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/hmpp-room.png' });

// Single voter -> voting finishes -> reveal + results + confetti
await page.getByRole('button', { name: 'Vote 5', exact: true }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/hmpp-room-revealed.png' });

// Dark theme via the icon dropdown
await page.getByRole('button', { name: 'Theme' }).click();
await page.waitForTimeout(200);
await page.getByRole('menuitem', { name: 'Dark' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/hmpp-room-dark.png' });

await browser.close();
console.log('screenshots written to /tmp/hmpp-*.png');
