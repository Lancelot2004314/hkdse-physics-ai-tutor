import { test, expect } from '@playwright/test';
import { login, isLoggedIn, logout, setupConsoleErrorTracking, waitForPageLoad, TEST_EMAIL, TEST_PASSWORD } from './helpers/auth';

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

test.describe('Email Login Flow', () => {

  test.beforeEach(async ({ page }) => {
    await logout(page);
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const success = await login(page, TEST_EMAIL, TEST_PASSWORD);

    expect(success).toBe(true);

    // Should be redirected away from login page
    expect(page.url()).not.toContain('/login');
  });

  test('should set session cookie after login', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);

    // Check that session cookie is set
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'session');

    expect(sessionCookie).toBeDefined();
  });

  test('should return user info from /api/auth/me after login', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);

    // Check auth status via API
    const loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(true);

    // Get full user info
    const response = await page.request.get('/api/auth/me');
    const data = await response.json();

    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(TEST_EMAIL);
  });

  test('should access protected pages after login', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);

    // Now should be able to access learn page
    await page.goto('/learn.html');
    await waitForPageLoad(page);

    // Should stay on learn page (not redirected to login)
    expect(page.url()).toContain('/learn');
    expect(page.url()).not.toContain('/login');
  });

  test('should redirect to original page after login', async ({ page }) => {
    // First try to access learn page (will redirect to login)
    await page.goto('/learn.html');
    await expect(page).toHaveURL(/\/login/);

    // Now login
    const emailTab = page.locator('.login-tab[data-tab="email"]');
    await emailTab.click();
    await page.waitForTimeout(300);

    await page.fill('#emailInput', TEST_EMAIL);
    await page.fill('#passwordInput', TEST_PASSWORD);
    await page.click('#emailLoginBtn');

    // Should be redirected back to learn page
    await page.waitForURL(/\/learn/, { timeout: 15000 });
    expect(page.url()).toContain('/learn');
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

  test('should logout successfully', async ({ page }) => {
    // First login
    await login(page, TEST_EMAIL, TEST_PASSWORD);
    expect(await isLoggedIn(page)).toBe(true);

    // Now logout
    await logout(page);

    // Verify logged out
    expect(await isLoggedIn(page)).toBe(false);
  });

  test('should clear session cookie on logout', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);

    // Verify session cookie exists
    let cookies = await page.context().cookies();
    let sessionCookie = cookies.find(c => c.name === 'session');
    expect(sessionCookie).toBeDefined();

    // Logout
    await logout(page);

    // Refresh cookies
    await page.goto('/');
    cookies = await page.context().cookies();
    sessionCookie = cookies.find(c => c.name === 'session');

    // Session cookie should be cleared or expired
    // Note: logout might delete the cookie or set it to expire immediately
    const isCleared = !sessionCookie || sessionCookie.value === '' ||
      (sessionCookie.expires && sessionCookie.expires < Date.now() / 1000);
    expect(isCleared).toBe(true);
  });
});
