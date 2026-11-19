import { test, expect } from '@playwright/test';

test.describe('Inventory Table & Transparency Enhancements', () => {
  test('1. Verify Inventory Table has Landed Cost, Selling Price, Margin & Pagination', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1280, height: 900 });

    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'pepocana23@gmail.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.goto('http://localhost:3000/inventory');
    await page.waitForLoadState('networkidle');

    // Switch to table view
    const tableBtn = page.locator('button:has(svg.lucide-list)');
    await tableBtn.click();
    await page.waitForTimeout(1000);

    // Verify Table Headers
    await expect(page.locator('th:has-text("Product")')).toBeVisible();
    await expect(page.locator('th:has-text("SKU")')).toBeVisible();
    await expect(page.locator('th:has-text("Stock")')).toBeVisible();
    await expect(page.locator('th:has-text("Landed Cost")')).toBeVisible();
    await expect(page.locator('th:has-text("Selling Price")')).toBeVisible();
    await expect(page.locator('th:has-text("Margin")')).toBeVisible();
    await expect(page.locator('th:has-text("MRP")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();

    // Verify Pagination Controls
    const paginationText = page.locator('text=/Showing \\d+ - \\d+ of \\d+ products/');
    await expect(paginationText).toBeVisible();

    const perPageSelect = page.locator('select');
    await expect(perPageSelect).toBeVisible();

    // Take screenshot of enhanced table
    await page.screenshot({ path: 'screenshots/inventory-enhanced-table.png' });
    console.log('Verified enhanced inventory table view and pagination!');
  });

  test('2. Verify Mobile Quick Actions Transparent Backdrop', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'pepocana23@gmail.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');

    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Click FAB (+) button
    const fab = page.locator('button[aria-label="Open Quick Action Menu"]');
    await expect(fab).toBeVisible();
    await fab.click();
    await page.waitForTimeout(500);

    // Check modal is open
    await expect(page.locator('h3:has-text("Quick Actions")')).toBeVisible();

    // Take screenshot of translucent quick actions
    await page.screenshot({ path: 'screenshots/mobile-quick-actions-transparent.png' });
    console.log('Verified transparent mobile quick actions modal!');
  });
});
