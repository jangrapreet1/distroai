const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function main() {
    const svgPath = path.join(__dirname, 'src', 'app', 'icon.svg');
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    const publicDir = path.join(__dirname, 'public');

    // Copy SVG files to public
    fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);
    fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent);

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; background: transparent; }
            svg { width: 100%; height: 100%; }
        </style>
    </head>
    <body>
        ${svgContent}
    </body>
    </html>
    `;

    const browser = await chromium.launch({ headless: true });

    // 192x192 icon
    const page192 = await browser.newPage({ viewport: { width: 192, height: 192 } });
    await page192.setContent(htmlContent);
    await page192.screenshot({ path: path.join(publicDir, 'icon-192.png'), omitBackground: true });
    await page192.close();

    // 512x512 icon
    const page512 = await browser.newPage({ viewport: { width: 512, height: 512 } });
    await page512.setContent(htmlContent);
    await page512.screenshot({ path: path.join(publicDir, 'icon-512.png'), omitBackground: true });
    await page512.screenshot({ path: path.join(publicDir, 'apple-touch-icon.png'), omitBackground: true });
    await page512.close();

    // 32x32 favicon png
    const page32 = await browser.newPage({ viewport: { width: 32, height: 32 } });
    await page32.setContent(htmlContent);
    const faviconPngPath = path.join(publicDir, 'favicon.png');
    await page32.screenshot({ path: faviconPngPath, omitBackground: true });
    fs.copyFileSync(faviconPngPath, path.join(publicDir, 'favicon.ico'));
    await page32.close();

    await browser.close();
    console.log("Successfully generated icon-192.png, icon-512.png, apple-touch-icon.png, favicon.ico, and icon.svg in public/");
}

main().catch((err) => {
    console.error("Error generating icons:", err);
    process.exit(1);
});
