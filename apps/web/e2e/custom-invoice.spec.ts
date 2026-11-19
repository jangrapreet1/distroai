import { test, expect } from '@playwright/test';

test.describe('Custom Invoice Feature E2E', () => {
    test.use({ baseURL: 'http://localhost:3000' });

    test('should create custom invoice without GST and customize layout on detail page', async ({ page }) => {
        // 1. Login
        await page.goto('/login');
        await page.fill('input[type="email"]', 'pepocana23@gmail.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');

        // Wait for redirect to dashboard
        await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

        // 2. Go to /invoices
        await page.goto('/invoices');
        await expect(page.locator('h1')).toContainText('Invoices');

        // 3. Verify '+ Create Custom Invoice' button is present and click it
        const createBtn = page.getByRole('button', { name: 'Create Custom Invoice' }).first();
        await expect(createBtn).toBeVisible();
        await createBtn.click();

        // 4. Modal should open
        await expect(page.getByRole('heading', { name: 'Create Custom Invoice' })).toBeVisible();

        // Wait for customer and product options to load
        const customerOption = page.locator('select option:not([value=""])').first();
        await customerOption.waitFor({ state: 'attached', timeout: 10000 });
        const customerSelect = page.locator('select').first();
        await customerSelect.selectOption({ index: 1 });

        // Wait for product select options to load
        const productOption = page.locator('table select option:not([value=""])').first();
        await productOption.waitFor({ state: 'attached', timeout: 10000 });
        const productSelect = page.locator('table select').first();
        await productSelect.selectOption({ index: 1 });

        // Set quantity
        const qtyInput = page.locator('input[type="number"][min="1"]').first();
        await qtyInput.fill('3');

        // 5. Expand Customization Accordion
        const accordionBtn = page.locator('button:has-text("Invoice Customization & Display Settings")');
        await accordionBtn.click();

        // Toggle OFF Include GST Number
        const gstCheckbox = page.locator('label:has-text("Include GST Number (GSTIN)") input[type="checkbox"]');
        await expect(gstCheckbox).toBeChecked();
        await gstCheckbox.uncheck();

        // Check that heading switches to BILL OF SUPPLY
        const titleSelect = page.locator('select:has-text("Bill of Supply")');
        await expect(titleSelect).toHaveValue('BILL OF SUPPLY');

        // Add Notes
        const notesInput = page.locator('input[placeholder="Optional notes or remarks"]');
        await notesInput.fill('Verified via Playwright Browser Test');

        // 6. Submit invoice creation
        const submitBtn = page.locator('form').getByRole('button', { name: 'Create Custom Invoice' });
        await submitBtn.click();

        // Wait for redirection to invoice detail page
        await page.waitForURL(/\/invoices\/[a-zA-Z0-9]+/, { timeout: 15000 });

        // 7. Verify Detail Page
        // Check for 'Non-GST / Bill of Supply' badge
        await expect(page.locator('text=Non-GST / Bill of Supply').first()).toBeVisible({ timeout: 10000 });

        // Verify 'Customize & Print' button is visible
        const customizeBtn = page.getByRole('button', { name: /Customize & Print/i });
        await expect(customizeBtn).toBeVisible();

        // 8. Open Customize & Print Modal
        await customizeBtn.click();
        await expect(page.getByRole('heading', { name: 'Customize Invoice & PDF' })).toBeVisible();

        // Verify toggles inside modal
        await expect(page.locator('label:has-text("Include GST Number (GSTIN)")')).toBeVisible();
        await expect(page.locator('label:has-text("Show PAN Number")')).toBeVisible();
        await expect(page.locator('label:has-text("Show HSN / SAC Codes")')).toBeVisible();
        await expect(page.locator('label:has-text("Show Discount Column")')).toBeVisible();
        await expect(page.locator('label:has-text("Show Dynamic UPI QR Code")')).toBeVisible();
        await expect(page.locator('label:has-text("Show Terms & Conditions")')).toBeVisible();

        // Verify Save and Download buttons are available
        await expect(page.getByRole('button', { name: 'Save for this Invoice' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Print / Preview' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();

        // Save a screenshot as verification proof
        await page.screenshot({ path: 'custom-invoice-verified.png' });

        console.log('🎉 E2E BROWSER TEST PASSED COMPLETELY!');
    });
});
