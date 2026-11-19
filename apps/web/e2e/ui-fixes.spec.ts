import { test, expect } from '@playwright/test';

test.describe('UI Error Fixes & Mobile Layout Verifications', () => {
  test.use({
    viewport: { width: 390, height: 844 }, // iPhone 12/13/14 mobile viewport
  });

  test('1. Verify Dashboard has the AI copilot hero card removed', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'pepocana23@gmail.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Confirm that "[AI_COPILOT // LIVE]" and "Here's your day" are completely gone
    const aiCopilotBadge = page.locator('text=[AI_COPILOT // LIVE]');
    await expect(aiCopilotBadge).toHaveCount(0);

    const heresYourDay = page.locator("text=Here's your day");
    await expect(heresYourDay).toHaveCount(0);

    // Confirm KPI cards are visible directly at the top
    await expect(page.locator('h3:has-text("Revenue")').first()).toBeVisible();
    await expect(page.locator('h3:has-text("Orders")').first()).toBeVisible();

    await page.screenshot({ path: 'screenshots/dashboard-mobile-hero-removed.png' });
  });

  test('2. Verify AI page on mobile has ChatInput clearly visible above MobileBottomNav', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'pepocana23@gmail.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.goto('http://localhost:3000/ai');
    await page.waitForLoadState('networkidle');

    // Check that chat input textarea is visible
    const textarea = page.locator('textarea[placeholder*="for commands"]');
    await expect(textarea).toBeVisible();

    // Check that mobile bottom nav is present
    const bottomNav = page.locator('nav[aria-label="Mobile Bottom Navigation"]');
    await expect(bottomNav).toBeVisible();

    // Verify bounding boxes: bottom of textarea must be strictly ABOVE the top of the mobile bottom nav
    const textareaBox = await textarea.boundingBox();
    const navBox = await bottomNav.boundingBox();

    expect(textareaBox).not.toBeNull();
    expect(navBox).not.toBeNull();

    console.log('Textarea bottom:', textareaBox!.y + textareaBox!.height, 'Nav top:', navBox!.y);
    expect(textareaBox!.y + textareaBox!.height).toBeLessThan(navBox!.y);

    await page.screenshot({ path: 'screenshots/ai-mobile-no-overlap.png' });
  });

  test('3. Verify Login page contrast in light & dark mode', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    // Check heading visibility and text color
    const heading = page.locator('h2:has-text("Welcome back")');
    await expect(heading).toBeVisible();

    // Check Google button visibility
    const googleBtn = page.locator('a:has-text("Google")');
    await expect(googleBtn).toBeVisible();

    await page.screenshot({ path: 'screenshots/login-contrast-mode.png' });
  });

  test('4. Verify Landing Page WhatsApp simulator text contrast', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Check that simulator heading is visible
    const simHeading = page.locator('text=Experience the WhatsApp');
    await expect(simHeading).toBeVisible();

    await page.screenshot({ path: 'screenshots/landing-simulator-contrast.png' });
  });
});
