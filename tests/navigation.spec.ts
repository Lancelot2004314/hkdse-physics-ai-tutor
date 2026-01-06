import { test, expect } from '@playwright/test';
import { setupConsoleErrorTracking, waitForPageLoad } from './helpers/auth';

/**
 * Navigation tests that don't require authentication
 * Tests that require auth are in navigation.authenticated.spec.ts
 */

test.describe('Navigation Tests', () => {

  const pages = [
    { path: '/', name: 'Home' },
    { path: '/learn.html', name: 'Learn' },
    { path: '/leaderboard.html', name: 'Leaderboard' },
    { path: '/quests.html', name: 'Quests' },
    { path: '/shop.html', name: 'Shop' },
    { path: '/profile.html', name: 'Profile' },
    { path: '/settings.html', name: 'Settings' },
  ];

  for (const pageInfo of pages) {
    test(`${pageInfo.name} page should load without critical errors`, async ({ page }) => {
      const errors = setupConsoleErrorTracking(page);

      await page.goto(pageInfo.path);
      await page.waitForTimeout(2000);

      // Filter critical errors
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource') &&
        !e.includes('KaTeX') &&
        (e.includes('Cannot read') ||
          e.includes('undefined') ||
          e.includes('null') ||
          e.includes('TypeError') ||
          e.includes('ReferenceError'))
      );

      if (criticalErrors.length > 0) {
        console.log(`Errors on ${pageInfo.name}:`, criticalErrors);
      }

      expect(criticalErrors).toHaveLength(0);
    });
  }
});

test.describe('Sidebar Navigation', () => {

  test('all sidebar links should be valid', async ({ page }) => {
    await page.goto('/learn.html');
    await page.waitForTimeout(2000);

    // Get all sidebar nav links
    const navLinks = page.locator('.sidebar .nav-item[href], .sidebar-nav a[href]');
    const count = await navLinks.count();

    const brokenLinks: string[] = [];

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      if (href && href.startsWith('/')) {
        try {
          const response = await page.request.get(href);
          if (response.status() === 404) {
            brokenLinks.push(href);
          }
        } catch (e) {
          brokenLinks.push(href);
        }
      }
    }

    if (brokenLinks.length > 0) {
      console.log('Broken links:', brokenLinks);
    }

    expect(brokenLinks).toHaveLength(0);
  });

  test('sidebar should be visible on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/learn.html');
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      // Check login page has its own navigation
      return;
    }

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
  });
});

test.describe('Page Layout', () => {

  test('pages should have proper document title', async ({ page }) => {
    const pages = ['/learn.html', '/leaderboard.html', '/quests.html', '/shop.html'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForTimeout(1000);

      const title = await page.title();
      // Title should not be empty or just "undefined"
      expect(title).not.toBe('');
      expect(title).not.toContain('undefined');
    }
  });

  test('pages should have meta viewport for mobile', async ({ page }) => {
    await page.goto('/learn.html');

    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveCount(1);
  });
});

test.describe('Responsive Design', () => {

  test('sidebar should collapse on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/learn.html');
    await page.waitForTimeout(2000);

    if (page.url().includes('/login')) {
      return;
    }

    // Sidebar should be hidden or collapsed on mobile
    const sidebar = page.locator('.sidebar');

    // Either hidden or has reduced width
    const isHidden = await sidebar.isHidden();
    if (!isHidden) {
      const box = await sidebar.boundingBox();
      // Width should be small (collapsed) or 0
      if (box) {
        expect(box.width).toBeLessThanOrEqual(100);
      }
    }
  });
});
