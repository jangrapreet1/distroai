import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/.*\/login/);
    });

    test('should allow user to login with valid credentials', async ({ page }) => {
        // We mock the API call since we don't want to rely on the backend for this test
        await page.route('**/api/v1/auth/login', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        accessToken: 'mock-jwt-token',
                        refreshToken: 'mock-refresh-token',
                        user: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@company.com', role: 'ADMIN' },
                        org: { id: '1', name: 'Test Org', plan: 'PRO' }
                    }
                })
            });
        });

        // Mock dashboard data to prevent an error after redirect
        await page.route('**/api/v1/analytics/dashboard', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        today: { revenue: 1000, orders: 10 },
                        collections: { totalOutstanding: 5000 },
                        inventory: { lowStockCount: 2 }
                    }
                })
            });
        });

        await page.goto('/login');

        // Fill credentials
        await page.fill('input[type="email"]', 'test@company.com');
        await page.fill('input[type="password"]', 'P@ssw0rd123');

        // Submit
        await page.click('button[type="submit"]');

        // Should redirect to dashboard
        await expect(page).toHaveURL('/');

        // Should see user name in sidebar
        await expect(page.locator('text=Test User')).toBeVisible();
    });
});
