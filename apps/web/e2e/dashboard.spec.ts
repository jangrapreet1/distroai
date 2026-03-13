import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
        // Setup auth cookie to bypass login page
        await page.context().addCookies([
            { name: 'accessToken', value: 'mock-jwt-token', domain: 'localhost', path: '/' }
        ]);

        // Mock dashboard API
        await page.route('**/api/v1/analytics/dashboard', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
        });

        await page.goto('/');
    });

    test('should verify sidebar navigation links', async ({ page }) => {
        // Verify main navigation groups are present
        await expect(page.locator('text=OPERATIONS')).toBeVisible();
        await expect(page.locator('text=FINANCE')).toBeVisible();
        await expect(page.locator('text=INTELLIGENCE')).toBeVisible();

        // Navigate to Orders
        await page.route('**/api/v1/orders*', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], meta: { total: 0, pages: 1 } }) });
        });
        await page.click('nav >> text=Orders');
        await expect(page).toHaveURL('/orders');
        await expect(page.locator('h1', { hasText: 'Orders' })).toBeVisible();

        // Navigate to Inventory
        await page.route('**/api/v1/products*', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], meta: { total: 0 } }) });
        });
        await page.click('nav >> text=Inventory');
        await expect(page).toHaveURL('/inventory');
        await expect(page.locator('h1', { hasText: 'Inventory' })).toBeVisible();
    });
});
