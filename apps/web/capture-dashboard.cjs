const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function capture() {
    const outDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    console.log("Authenticating with backend API http://localhost:3001/api/v1/auth/login...");
    let authData = null;
    try {
        let res = await fetch('http://localhost:3001/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'owner@acmetraders.in',
                password: 'password123',
            }),
        });
        let json = await res.json();
        let body = json.data || json;

        if (body.requireOrgSelection && body.orgs && body.orgs.length > 0) {
            const orgId = body.orgs[0].orgId;
            console.log("Selecting organization:", orgId);
            res = await fetch('http://localhost:3001/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'owner@acmetraders.in',
                    password: 'password123',
                    orgId: orgId,
                }),
            });
            json = await res.json();
            body = json.data || json;
        }

        authData = body;
        console.log("Login completed! Token received:", !!authData.accessToken);
    } catch (e) {
        console.error("Fetch error:", e.message);
    }

    if (!authData || !authData.accessToken) {
        console.error("No accessToken received. Exiting.");
        process.exit(1);
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 960 },
    });

    // Set cookie on localhost
    await context.addCookies([
        {
            name: 'accessToken',
            value: authData.accessToken,
            domain: 'localhost',
            path: '/',
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
        },
    ]);

    const page = await context.newPage();

    // Inject token to localStorage
    await page.addInitScript((data) => {
        const authState = {
            state: {
                user: data.user,
                org: data.org,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                isAuthenticated: true,
            },
            version: 0,
        };
        localStorage.setItem("distroai-auth", JSON.stringify(authState));
    }, authData);

    console.log("Navigating to http://localhost:3000/dashboard...");
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log("DOM content loaded, waiting for animations and queries...");
    await page.waitForTimeout(4000);

    // Capture full dashboard overview
    await page.screenshot({ path: path.join(outDir, '09_dashboard_overview.png'), fullPage: true });
    console.log("Saved 09_dashboard_overview.png");

    await browser.close();
    console.log("Dashboard capture complete!");
}

capture().catch((err) => {
    console.error("Error capturing dashboard:", err);
    process.exit(1);
});
