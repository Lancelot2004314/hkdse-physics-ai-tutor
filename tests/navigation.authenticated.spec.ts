import { test, expect } from '@playwright/test';

/**
 * Navigation tests that require authentication
 * These tests run with pre-authenticated session state
 */

test.describe('Navigation (Authenticated)', () => {

    test('clicking nav items should navigate correctly', async ({ page }) => {
        await page.goto('/learn.html');
        await page.waitForTimeout(2000);

        // Should be on learn page (not login)
        expect(page.url()).toContain('/learn');

        // Click on Shop nav item
        const shopLink = page.locator('.nav-item:has-text("Shop")');
        if (await shopLink.count() > 0) {
            await shopLink.click();
            await page.waitForTimeout(1000);

            expect(page.url()).toContain('shop');
        }
    });

    test('should navigate from learn to quests', async ({ page }) => {
        await page.goto('/learn.html');
        await page.waitForTimeout(2000);

        const questsLink = page.locator('.nav-item:has-text("Quests")');
        if (await questsLink.count() > 0) {
            await questsLink.click();
            await page.waitForTimeout(1000);

            expect(page.url()).toContain('quests');
        }
    });

    test('should navigate from learn to leaderboard', async ({ page }) => {
        await page.goto('/learn.html');
        await page.waitForTimeout(2000);

        const leaderboardLink = page.locator('.nav-item:has-text("Leaderboards")');
        if (await leaderboardLink.count() > 0) {
            await leaderboardLink.click();
            await page.waitForTimeout(1000);

            expect(page.url()).toContain('leaderboard');
        }
    });

    test('should navigate to profile page', async ({ page }) => {
        await page.goto('/learn.html');
        await page.waitForTimeout(2000);

        // Look for profile link (could be avatar or text)
        const profileLink = page.locator('.nav-item:has-text("Profile"), a[href*="profile"]');
        if (await profileLink.count() > 0) {
            await profileLink.first().click();
            await page.waitForTimeout(1000);

            expect(page.url()).toContain('profile');
        }
    });

    test('sidebar should remain visible after navigation', async ({ page }) => {
        await page.goto('/learn.html');
        await page.waitForTimeout(2000);

        // Navigate to shop
        const shopLink = page.locator('.nav-item:has-text("Shop")');
        if (await shopLink.count() > 0) {
            await shopLink.click();
            await page.waitForTimeout(1000);

            // Sidebar should still be visible
            const sidebar = page.locator('.sidebar');
            await expect(sidebar).toBeVisible();
        }
    });
});

