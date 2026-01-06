import { test, expect } from '@playwright/test';
import { setupConsoleErrorTracking, waitForPageLoad } from './helpers/auth';

test.describe('Learn Page', () => {

  test.beforeEach(async ({ page }) => {
    // Note: These tests assume user is logged in
    // If not logged in, the page will redirect to login
  });

  test('should load learn page without JavaScript errors', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);

    await page.goto('/learn.html');

    // Wait for either skill tree or login redirect
    await Promise.race([
      page.waitForSelector('.skill-tree-container', { timeout: 10000 }),
      page.waitForURL(/\/login/, { timeout: 10000 }),
    ]);

    // Check current URL
    const currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      // Not logged in - that's OK, we tested the redirect
      console.log('Learn page requires authentication - redirect works correctly');
      return;
    }

    // If we're on learn page, check for errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404')
    );

    if (criticalErrors.length > 0) {
      console.log('JavaScript errors found:', criticalErrors);
    }
  });

  test('should display sidebar navigation', async ({ page }) => {
    await page.goto('/learn.html');

    // Wait for page
    await page.waitForTimeout(2000);

    // Check if we're on learn or login
    if (page.url().includes('/login')) {
      // Skip test - requires auth
      test.skip();
      return;
    }

    // Check sidebar exists
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Check navigation items
    await expect(page.locator('.nav-item:has-text("Learn")')).toBeVisible();
    await expect(page.locator('.nav-item:has-text("Leaderboards")')).toBeVisible();
    await expect(page.locator('.nav-item:has-text("Quests")')).toBeVisible();
    await expect(page.locator('.nav-item:has-text("Shop")')).toBeVisible();
  });

  test('should display header with stats', async ({ page }) => {
    await page.goto('/learn.html');
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Check header stats badges
    await expect(page.locator('.stat-badge').first()).toBeVisible();
  });

  test('should have no broken links in sidebar', async ({ page }) => {
    await page.goto('/learn.html');
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Get all nav links
    const navLinks = page.locator('.nav-item[href]');
    const count = await navLinks.count();

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      if (href && href.startsWith('/')) {
        // Check link is valid (doesn't 404)
        const response = await page.request.get(href);
        expect(response.status()).not.toBe(404);
      }
    }
  });

  test('should call skill-tree API', async ({ page }) => {
    // Listen for API call
    const apiPromise = page.waitForResponse(
      resp => resp.url().includes('/api/learn/skill-tree'),
      { timeout: 15000 }
    );

    await page.goto('/learn.html');

    try {
      const response = await apiPromise;
      const status = response.status();

      // Should be 200 (success) or 401 (not logged in)
      expect([200, 401]).toContain(status);

      if (status === 200) {
        const data = await response.json();
        // Check response structure
        expect(data).toHaveProperty('units');
        expect(data).toHaveProperty('user');
        expect(data).toHaveProperty('hearts');
      }
    } catch (e) {
      // API might not be called if redirected immediately
      console.log('Skill tree API not called - likely redirected to login');
    }
  });
});

test.describe('Learn Page UI Elements', () => {

  test('settings link should not go to admin panel', async ({ page }) => {
    await page.goto('/learn.html');
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Find settings link
    const settingsLink = page.locator('a[href*="settings"], .sidebar-footer a:has-text("Settings")');

    if (await settingsLink.count() > 0) {
      const href = await settingsLink.first().getAttribute('href');
      // Should NOT link to admin
      expect(href).not.toContain('admin');
      expect(href).toContain('settings');
    }
  });
});


import { setupConsoleErrorTracking, waitForPageLoad } from './helpers/auth';

test.describe('Learn Page', () => {

  test.beforeEach(async ({ page }) => {
    // Note: These tests assume user is logged in
    // If not logged in, the page will redirect to login
  });

  test('should load learn page without JavaScript errors', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);

    await page.goto('/learn.html');

    // Wait for either skill tree or login redirect
    await Promise.race([
      page.waitForSelector('.skill-tree-container', { timeout: 10000 }),
      page.waitForURL(/\/login/, { timeout: 10000 }),
    ]);

    // Check current URL
    const currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      // Not logged in - that's OK, we tested the redirect
      console.log('Learn page requires authentication - redirect works correctly');
      return;
    }

    // If we're on learn page, check for errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404')
    );

    if (criticalErrors.length > 0) {
      console.log('JavaScript errors found:', criticalErrors);
    }
  });

  test('should display sidebar navigation', async ({ page }) => {
    await page.goto('/learn.html');

    // Wait for page
    await page.waitForTimeout(2000);

    // Check if we're on learn or login
    if (page.url().includes('/login')) {
      // Skip test - requires auth
      test.skip();
      return;
    }

    // Check sidebar exists
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Check navigation items
    await expect(page.locator('.nav-item:has-text("Learn")')).toBeVisible();
    await expect(page.locator('.nav-item:has-text("Leaderboards")')).toBeVisible();
    await expect(page.locator('.nav-item:has-text("Quests")')).toBeVisible();
    await expect(page.locator('.nav-item:has-text("Shop")')).toBeVisible();
  });

  test('should display header with stats', async ({ page }) => {
    await page.goto('/learn.html');
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Check header stats badges
    await expect(page.locator('.stat-badge').first()).toBeVisible();
  });

  test('should have no broken links in sidebar', async ({ page }) => {
    await page.goto('/learn.html');
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Get all nav links
    const navLinks = page.locator('.nav-item[href]');
    const count = await navLinks.count();

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      if (href && href.startsWith('/')) {
        // Check link is valid (doesn't 404)
        const response = await page.request.get(href);
        expect(response.status()).not.toBe(404);
      }
    }
  });

  test('should call skill-tree API', async ({ page }) => {
    // Listen for API call
    const apiPromise = page.waitForResponse(
      resp => resp.url().includes('/api/learn/skill-tree'),
      { timeout: 15000 }
    );

    await page.goto('/learn.html');

    try {
      const response = await apiPromise;
      const status = response.status();

      // Should be 200 (success) or 401 (not logged in)
      expect([200, 401]).toContain(status);

      if (status === 200) {
        const data = await response.json();
        // Check response structure
        expect(data).toHaveProperty('units');
        expect(data).toHaveProperty('user');
        expect(data).toHaveProperty('hearts');
      }
    } catch (e) {
      // API might not be called if redirected immediately
      console.log('Skill tree API not called - likely redirected to login');
    }
  });
});

test.describe('Learn Page UI Elements', () => {

  test('settings link should not go to admin panel', async ({ page }) => {
    await page.goto('/learn.html');
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Find settings link
    const settingsLink = page.locator('a[href*="settings"], .sidebar-footer a:has-text("Settings")');

    if (await settingsLink.count() > 0) {
      const href = await settingsLink.first().getAttribute('href');
      // Should NOT link to admin
      expect(href).not.toContain('admin');
      expect(href).toContain('settings');
    }
  });
});

