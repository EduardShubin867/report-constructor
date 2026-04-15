import { expect, test } from '@playwright/test';

test('keeps the selected source tab in the URL after reload', async ({ page }) => {
  await page.goto('/constructor/reports/manual');

  const dvsTab = page.getByRole('button', { name: 'ДВС' });
  const osagoTab = page.getByRole('button', { name: 'ОСАГО Маржа' });

  await dvsTab.click();
  await expect(page).toHaveURL(/\/reports\/manual\?sourceId=dvs$/);
  await expect(dvsTab).toHaveClass(/ui-chip-accent/);

  await page.reload();

  await expect(page).toHaveURL(/\/reports\/manual\?sourceId=dvs$/);
  await expect(page.getByRole('button', { name: 'ДВС' })).toHaveClass(/ui-chip-accent/);

  await osagoTab.click();
  await expect(page).toHaveURL(/\/reports\/manual$/);
});
