import { test, expect } from '@playwright/test';

// Before each test, we need to mock the authentication state
test.beforeEach(async ({ page }) => {
    // Navigate to the app (Playwright will start the dev server based on playwright.config.ts)
    await page.goto('/');

    // Set mock authentication data in localStorage so the app thinks we are logged in
    await page.evaluate(() => {
        localStorage.setItem('distroai-auth', JSON.stringify({
            state: {
                user: { id: "user-1", email: "test@example.com", firstName: "Test", role: "ADMIN" },
                org: { id: "org-1", name: "Test Org", plan: "ENTERPRISE" },
                accessToken: "fake-token",
                refreshToken: "fake-token",
                isAuthenticated: true
            },
            version: 0
        }));
    });

    // Mock the basic API responses so the dashboard renders without crashing
    await page.route('**/api/customers*', async route => {
        await route.fulfill({ json: { data: [], meta: { total: 0 } } });
    });
    await page.route('**/api/orders*', async route => {
        await route.fulfill({ json: { data: [], meta: { total: 0 } } });
    });
    
    // Reload the page to apply the mock auth state
    await page.reload();
});

test.describe('Dashboard Navigation Buttons', () => {
    test('can click through sidebar navigation buttons', async ({ page }) => {
        // Wait for the dashboard to load (we know we are logged in if the sidebar is visible)
        await expect(page.locator('text=DistroAI').first()).toBeVisible();

        // 1. Click "Customers" button
        await page.click('button:has-text("Customers")');
        // Verify the Customers page loaded by checking the main heading
        await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();

        // 2. Click "Orders" button
        await page.click('button:has-text("Orders")');
        await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();

        // 3. Click "Inventory" button
        await page.click('button:has-text("Inventory")');
        await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
    });

    test('can open Add Customer modal using the primary action button', async ({ page }) => {
        // Navigate to Customers page first
        await page.click('button:has-text("Customers")');
        
        // Find and click the specific "Add Customer" action button
        const addCustomerButton = page.getByRole('button', { name: /Add Customer/i });
        await expect(addCustomerButton).toBeVisible();
        await addCustomerButton.click();

        // Verify the modal opened
        const modalHeading = page.getByRole('heading', { name: 'Add Customer' }).last();
        await expect(modalHeading).toBeVisible();

        // Click the close/cancel button (the X icon or Cancel text)
        const cancelButton = page.getByRole('button', { name: 'Cancel' });
        await cancelButton.click();

        // Verify modal closed
        await expect(modalHeading).not.toBeVisible();
    });
});
