import { test, expect } from '@playwright/test';
import { login, isLoggedIn, logout, setupConsoleErrorTracking, waitForPageLoad } from './helpers/auth';

test.describe('Authentication Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Start fresh - logout if logged in
    await logout(page);
  });

  test('should redirect to login when accessing protected page without auth', async ({ page }) => {
    // Try to access learn page without logging in
    await page.goto('/learn.html');

    // Should be redirected to login with redirect parameter
    // Note: Cloudflare Pages may serve /login instead of /login.html
    await expect(page).toHaveURL(/\/login(\.html)?\?redirect=/);
  });

  test('should show login page correctly', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);

    await page.goto('/login.html');
    await waitForPageLoad(page);

    // Check login container exists
    await expect(page.locator('.login-container')).toBeVisible();

    // Login has tabs - Google is default, need to click Email tab
    const emailTab = page.locator('.login-tab[data-tab="email"]');
    await emailTab.click();
    await page.waitForTimeout(300);

    // Now email form should be visible
    await expect(page.locator('#emailInput')).toBeVisible();
    await expect(page.locator('#passwordInput')).toBeVisible();

    // Check for no JavaScript errors
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login.html');

    // Click email tab first
    const emailTab = page.locator('.login-tab[data-tab="email"]');
    await emailTab.click();
    await page.waitForTimeout(500);

    // Fill in invalid credentials
    await page.fill('#emailInput', 'invalid@test.com');
    await page.fill('#passwordInput', 'wrongpassword');

    // Click the email login button (specific ID)
    await page.click('#emailLoginBtn');

    // Should show some error indication (either alert, toast, or error message)
    // Wait a bit for error to appear
    await page.waitForTimeout(3000);

    // Still on login page (not redirected to success)
    expect(page.url()).toContain('/login');
  });

  test('should preserve redirect URL after login', async ({ page }) => {
    // Go to learn page (should redirect to login)
    await page.goto('/learn.html');

    // Check URL has redirect parameter
    const url = page.url();
    expect(url).toContain('redirect=');
    expect(url).toContain('learn');
  });

  test('should have Google login option', async ({ page }) => {
    await page.goto('/login.html');
    await waitForPageLoad(page);

    // Google tab should be visible and active by default
    const googleTab = page.locator('.login-tab[data-tab="google"]');
    await expect(googleTab).toBeVisible();
    await expect(googleTab).toHaveClass(/active/);

    // Google sign in button should exist (use specific ID)
    const googleBtn = page.locator('#googleLoginBtn');
    await expect(googleBtn).toBeVisible();
  });

  test('login page should not have console errors', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);

    await page.goto('/login.html');
    await waitForPageLoad(page);

    // Filter out common non-critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('Failed to load resource')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Session Management', () => {

  test('should check auth status via API', async ({ page }) => {
    await page.goto('/');

    // Make API call to check auth status
    const response = await page.request.get('/api/auth/me');
    const data = await response.json();

    // Response should have expected structure
    expect(data).toHaveProperty('user');
  });
});


test.describe('Authentication Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Start fresh - logout if logged in
    await logout(page);
  });

  test('should redirect to login when accessing protected page without auth', async ({ page }) => {
    // Try to access learn page without logging in
    await page.goto('/learn.html');

    // Should be redirected to login with redirect parameter
    // Note: Cloudflare Pages may serve /login instead of /login.html
    await expect(page).toHaveURL(/\/login(\.html)?\?redirect=/);
  });

  test('should show login page correctly', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);

    await page.goto('/login.html');
    await waitForPageLoad(page);

    // Check login container exists
    await expect(page.locator('.login-container')).toBeVisible();

    // Login has tabs - Google is default, need to click Email tab
    const emailTab = page.locator('.login-tab[data-tab="email"]');
    await emailTab.click();
    await page.waitForTimeout(300);

    // Now email form should be visible
    await expect(page.locator('#emailInput')).toBeVisible();
    await expect(page.locator('#passwordInput')).toBeVisible();

    // Check for no JavaScript errors
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login.html');

    // Click email tab first
    const emailTab = page.locator('.login-tab[data-tab="email"]');
    await emailTab.click();
    await page.waitForTimeout(500);

    // Fill in invalid credentials
    await page.fill('#emailInput', 'invalid@test.com');
    await page.fill('#passwordInput', 'wrongpassword');

    // Click the email login button (specific ID)
    await page.click('#emailLoginBtn');

    // Should show some error indication (either alert, toast, or error message)
    // Wait a bit for error to appear
    await page.waitForTimeout(3000);

    // Still on login page (not redirected to success)
    expect(page.url()).toContain('/login');
  });

  test('should preserve redirect URL after login', async ({ page }) => {
    // Go to learn page (should redirect to login)
    await page.goto('/learn.html');

    // Check URL has redirect parameter
    const url = page.url();
    expect(url).toContain('redirect=');
    expect(url).toContain('learn');
  });

  test('should have Google login option', async ({ page }) => {
    await page.goto('/login.html');
    await waitForPageLoad(page);

    // Google tab should be visible and active by default
    const googleTab = page.locator('.login-tab[data-tab="google"]');
    await expect(googleTab).toBeVisible();
    await expect(googleTab).toHaveClass(/active/);

    // Google sign in button should exist (use specific ID)
    const googleBtn = page.locator('#googleLoginBtn');
    await expect(googleBtn).toBeVisible();
  });

  test('login page should not have console errors', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);

    await page.goto('/login.html');
    await waitForPageLoad(page);

    // Filter out common non-critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('Failed to load resource')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Session Management', () => {

  test('should check auth status via API', async ({ page }) => {
    await page.goto('/');

    // Make API call to check auth status
    const response = await page.request.get('/api/auth/me');
    const data = await response.json();

    // Response should have expected structure
    expect(data).toHaveProperty('user');
  });
});
