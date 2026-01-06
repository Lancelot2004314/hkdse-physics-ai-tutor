import { test, expect } from '@playwright/test';
import { setupConsoleErrorTracking } from './helpers/auth';

/**
 * Learn Page tests that require authentication
 * These tests run with pre-authenticated session state
 */

test.describe('Learn Page (Authenticated)', () => {

    test('should display sidebar navigation', async ({ page }) => {
        await page.goto('/learn.html');
        await page.waitForTimeout(2000);

        // Should be on learn page (not redirected to login)
        expect(page.url()).toContain('/learn');
        expect(page.url()).not.toContain('/login');

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

        // Should be on learn page
        expect(page.url()).toContain('/learn');

        // Check header stats badges
        await expect(page.locator('.stat-badge').first()).toBeVisible();
    });

    test('should have no broken links in sidebar', async ({ page }) => {
        await page.goto('/learn.html');
        await page.waitForTimeout(2000);

        // Get all nav links
        const navLinks = page.locator('.nav-item[href]');
        const count = await navLinks.count();

        const brokenLinks: string[] = [];

        for (let i = 0; i < count; i++) {
            const href = await navLinks.nth(i).getAttribute('href');
            if (href && href.startsWith('/')) {
                // Check link is valid (doesn't 404)
                const response = await page.request.get(href);
                if (response.status() === 404) {
                    brokenLinks.push(href);
                }
            }
        }

        expect(brokenLinks).toHaveLength(0);
    });

    test('settings link should not go to admin panel', async ({ page }) => {
        await page.goto('/learn.html');
        await page.waitForTimeout(2000);

        // Find settings link
        const settingsLink = page.locator('a[href*="settings"], .sidebar-footer a:has-text("Settings")');

        if (await settingsLink.count() > 0) {
            const href = await settingsLink.first().getAttribute('href');
            // Should NOT link to admin
            expect(href).not.toContain('admin');
            expect(href).toContain('settings');
        }
    });

    test('should display skill tree with units', async ({ page }) => {
        await page.goto('/learn.html');
        await page.waitForTimeout(3000);

        // Skill tree container should be visible
        const skillTree = page.locator('.skill-tree-container, .skill-tree, #skillTree');
        await expect(skillTree.first()).toBeVisible();

        // Should have at least one unit
        const units = page.locator('.unit, .skill-unit, [class*="unit"]');
        const unitCount = await units.count();
        expect(unitCount).toBeGreaterThan(0);
    });
});

