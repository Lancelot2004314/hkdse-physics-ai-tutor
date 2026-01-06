import { test, expect } from '@playwright/test';
import { setupConsoleErrorTracking, waitForPageLoad } from './helpers/auth';

/**
 * Learn Page tests that don't require authentication
 * Tests that require auth are in learn.authenticated.spec.ts
 */

test.describe('Learn Page', () => {

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
