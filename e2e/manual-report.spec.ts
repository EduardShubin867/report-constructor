import ExcelJS from 'exceljs';
import { expect, test } from '@playwright/test';

async function createExportBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Отчёт');

  sheet.columns = [
    { header: 'Агент', key: 'Агент', width: 20 },
    { header: 'Премия', key: 'Премия', width: 16 },
  ];
  sheet.addRow({ Агент: 'Альфа', Премия: 1200 });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test.describe('manual report smoke tests', () => {
  test('builds a report, supports sorting and pagination, and downloads Excel', async ({ page }) => {
    const exportBodies: Array<Record<string, unknown>> = [];
    const reportBodies: Array<Record<string, unknown>> = [];
    const exportBuffer = await createExportBuffer();
    const columnSection = page
      .getByRole('heading', { name: 'Какие колонки нужны' })
      .locator('xpath=ancestor::div[contains(@class,"ui-panel")][1]');
    const submitButton = page.getByRole('button', { name: 'Построить отчёт' }).last();

    await page.route('**/constructor/api/report', async route => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      reportBodies.push(body);

      const isSorted = body.sortColumn === 'Агент' && body.sortDirection === 'asc';
      const isSecondPage = body.page === 2;

      const payload = isSecondPage
        ? {
            data: [{ ID: '3', VIN: 'VIN-003', Агент: 'Гамма', Премия: 900 }],
            total: 120,
            page: 2,
            pageSize: 100,
          }
        : isSorted
          ? {
              data: [{ ID: '2', VIN: 'VIN-002', Агент: 'Бета', Премия: 2500 }],
              total: 120,
              page: 1,
              pageSize: 100,
            }
          : {
              data: [{ ID: '1', VIN: 'VIN-001', Агент: 'Альфа', Премия: 1200 }],
              total: 120,
              page: 1,
              pageSize: 100,
            };

      await route.fulfill({
        body: JSON.stringify(payload),
        contentType: 'application/json',
        status: 200,
      });
    });

    await page.route('**/constructor/api/report/export', async route => {
      exportBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        body: exportBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        status: 200,
      });
    });

    await page.goto('/constructor/reports/manual');

    await expect(page.getByRole('heading', { name: 'Соберите отчёт под свою задачу' })).toBeVisible();

    await columnSection.locator('label', { hasText: 'VIN' }).click();
    await columnSection.locator('label', { hasText: 'Агент' }).click();
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(page.getByRole('heading', { name: 'Последний запущенный отчёт' })).toBeVisible();
    await expect(page.getByText('Альфа')).toBeVisible();
    expect(reportBodies[0]?.columns).toEqual(expect.arrayContaining(['VIN', 'Агент']));

    await page.getByRole('columnheader', { name: /Агент/ }).click();
    await expect(page.getByText('Бета')).toBeVisible();
    expect(reportBodies.some(body => body.sortColumn === 'Агент' && body.sortDirection === 'asc')).toBe(true);

    await page.getByRole('button', { name: 'Следующая страница' }).click();
    await expect(page.getByText('Гамма')).toBeVisible();
    expect(reportBodies.some(body => body.page === 2)).toBe(true);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^report_\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(exportBodies).toHaveLength(1);
    expect(exportBodies[0]?.columns).toEqual(expect.arrayContaining(['VIN', 'Агент']));
  });

  test('builds grouped reports and can disable contract count', async ({ page }) => {
    const reportBodies: Array<Record<string, unknown>> = [];
    const columnSection = page
      .getByRole('heading', { name: 'Какие колонки нужны' })
      .locator('xpath=ancestor::div[contains(@class,"ui-panel")][1]');
    const groupSection = page
      .getByRole('heading', { name: 'Как разбить результат' })
      .locator('xpath=ancestor::div[contains(@class,"ui-panel")][1]');
    const submitButton = page.getByRole('button', { name: 'Построить отчёт' }).last();

    await page.route('**/constructor/api/report', async route => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      reportBodies.push(body);

      await route.fulfill({
        body: JSON.stringify({
          data: [{ Агент: 'Альфа', Премия: 3200 }],
          total: 1,
          page: 1,
          pageSize: 100,
        }),
        contentType: 'application/json',
        status: 200,
      });
    });

    await page.goto('/constructor/reports/manual');

    await columnSection.locator('label', { hasText: 'Агент' }).click();
    await groupSection.locator('label', { hasText: 'Агент' }).click();
    await expect(columnSection.getByText('Кол-во договоров')).toBeVisible();
    await columnSection.locator('label', { hasText: 'Кол-во договоров' }).click();
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(page.getByText('Альфа')).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Кол-во договоров' })).toHaveCount(0);
    expect(reportBodies[0]?.groupBy).toEqual(['Агент']);
    expect(reportBodies[0]?.includeContractCount).toBe(false);
  });
});
