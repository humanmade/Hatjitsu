import { test, expect } from '@playwright/test';

test('two users join, vote, reveal', async ({ browser }) => {
  const a = await browser.newContext(); const b = await browser.newContext();
  const pa = await a.newPage(); const pb = await b.newPage();

  await pa.goto('/');
  await pa.getByRole('button', { name: /create a room/i }).click();
  await pa.waitForURL(/\/room\//);
  const url = pa.url();
  await pb.goto(url);

  await pa.getByRole('button', { name: '5', exact: true }).click();
  await pb.getByRole('button', { name: '5', exact: true }).click();

  await expect(pa.getByText(/unanimous/i)).toBeVisible();
  await expect(pa.getByText(/Average/i)).toBeVisible();
});
