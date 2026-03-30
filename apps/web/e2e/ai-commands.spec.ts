import { test, expect } from '@playwright/test';

test.describe('Conversational AI Command System', () => {

    test.beforeEach(async ({ page }) => {
        // Mock Auth
        await page.route('**/api/v1/auth/login', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: { accessToken: 'mock-jwt', user: { id: '1', role: 'ADMIN' }, org: { id: '1' } }
                })
            });
        });

        // Mock Dashboard API so it doesn't fail on redirect
        await page.route('**/api/v1/analytics/dashboard', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
        });

        // Mock AI History
        await page.route('**/api/v1/ai/history', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
        });

        // Login
        await page.goto('/login');
        await page.fill('input[type="email"]', 'test@company.com');
        await page.fill('input[type="password"]', 'P@ssw0rd123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/');
    });

    test('should show command palette when typing /', async ({ page }) => {
        await page.goto('/ai');

        const input = page.locator('textarea[placeholder*="Type / for commands"]');
        await expect(input).toBeVisible();

        // Type /
        await input.fill('');
        await input.type('/');

        // Palette should appear
        const palette = page.locator('text=Commands');
        await expect(palette).toBeVisible();

        // Options should be visible
        await expect(page.locator('text=/order new')).toBeVisible();
        await expect(page.locator('text=/payment collect')).toBeVisible();

        // Press down arrow and enter
        await input.press('ArrowDown');

        // Mock the stream endpoint
        await page.route('**/api/v1/ai/query/stream', async route => {
            const ssePayload = 'data: ' + JSON.stringify({ token: '<ask_input step="Step 1 of 3" title="Which customer?">["Ramesh Kirana", "Shiv Traders", "Type manually"]</ask_input>', done: false }) + '\n\n';
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: ssePayload
            });
        });

        await input.press('Enter');

        // Check if the interactive card renders
        const cardTitle = page.locator('text=Which customer?');
        await expect(cardTitle).toBeVisible();

        const stepText = page.locator('text=< Step 1 of 3 >');
        await expect(stepText).toBeVisible();

        const opt1 = page.locator('text=Ramesh Kirana');
        await expect(opt1).toBeVisible();

        const manualOpt = page.locator('text=Type manually');
        await expect(manualOpt).toBeVisible();
        const skipOpt = page.locator('text=Skip');
        await expect(skipOpt).toBeVisible();
    });
});
