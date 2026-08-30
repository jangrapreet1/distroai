const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function main() {
    console.log("Launching Chromium browser...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    const outDir = '/home/preet/projects/distroai/screenshots';
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    console.log("Navigating to http://localhost:3000...");
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    console.log("Capturing Hero section...");
    await page.screenshot({ path: path.join(outDir, '01_hero.png') });

    console.log("Testing Interactive WhatsApp Demo...");
    const demoSection = page.locator('#interactive-demo');
    await demoSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Click on Hindi Voice Note preset tab
    const voiceTab = page.locator('button:has-text("Voice Note")');
    if (await voiceTab.count() > 0) {
        await voiceTab.click();
        await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(outDir, '02_interactive_demo_voice.png') });

    // Click on Ledger tab
    const ledgerTab = page.locator('button:has-text("Ledger")');
    if (await ledgerTab.count() > 0) {
        await ledgerTab.click();
        await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(outDir, '03_interactive_demo_ledger.png') });

    console.log("Capturing Features Showcase...");
    const featuresSection = page.locator('#features');
    await featuresSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '04_features.png') });

    console.log("Capturing ROI Calculator...");
    const roiSection = page.locator('#roi-calculator');
    await roiSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '05_roi_calculator.png') });

    console.log("Capturing Pricing...");
    const pricingSection = page.locator('#pricing');
    await pricingSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '06_pricing.png') });

    console.log("Capturing FAQ...");
    const faqSection = page.locator('#faq');
    await faqSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '07_faq.png') });

    console.log("Full page capture...");
    await page.screenshot({ path: path.join(outDir, '08_full_page.png'), fullPage: true });

    await browser.close();
    console.log("All screenshots captured successfully in:", outDir);
}

main().catch((err) => {
    console.error("Error capturing screenshots:", err);
    process.exit(1);
});
