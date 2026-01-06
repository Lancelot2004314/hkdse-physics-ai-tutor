import { test as setup, expect } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from './global-setup';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use absolute path to ensure consistency
const authFile = join(__dirname, '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
    console.log('🔐 Auth Setup: Logging in...');
    console.log('📁 Auth file path:', authFile);

    // Go to login page
    await page.goto('/login.html');

    // Wait for the login container to load
    await page.waitForSelector('.login-container', { timeout: 10000 });

    // Click the Email tab first (Google is default)
    const emailTab = page.locator('.login-tab[data-tab="email"]');
    await emailTab.click();
    await page.waitForTimeout(300);

    // Wait for email input to be visible
    await page.waitForSelector('#emailInput', { timeout: 5000 });

    // Fill in credentials
    await page.fill('#emailInput', TEST_EMAIL);
    await page.fill('#passwordInput', TEST_PASSWORD);

    // Click the email login button
    await page.click('#emailLoginBtn');

    // Wait for navigation away from login page
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });

    console.log('✅ Login successful, current URL:', page.url());

    // Verify we're logged in by checking the API
    const response = await page.request.get('/api/auth/me');
    const data = await response.json();

    if (data.user) {
        console.log('✅ User verified:', data.user.email);
    } else {
        console.log('⚠️ User not found in API response');
    }

    expect(data.user).toBeTruthy();

    // Save the authentication state
    await page.context().storageState({ path: authFile });
    console.log('💾 Auth state saved to:', authFile);
});
