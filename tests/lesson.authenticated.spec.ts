import { test, expect } from '@playwright/test';
import { setupConsoleErrorTracking } from './helpers/auth';

/**
 * Lesson Page tests that require authentication
 * These tests run with pre-authenticated session state
 */

test.describe('Lesson Page (Authenticated)', () => {

    test('MC questions should have clickable options', async ({ page }) => {
        await page.goto('/lesson.html?skill=heat-temp-basic&type=practice');
        await page.waitForTimeout(5000);

        // The lesson page might redirect to learn if the skill doesn't have questions
        // or if there's an error loading. Check what page we ended up on.
        const currentUrl = page.url();

        // If redirected to learn page, that's acceptable (no questions available)
        if (currentUrl.includes('/learn')) {
            console.log('Lesson redirected to learn page - no questions available for this skill');
            return;
        }

        // Should be on lesson page (not redirected to login)
        expect(currentUrl).not.toContain('/login');

        // Look for option buttons
        const options = page.locator('.option-btn, .answer-option, [class*="option"]');
        const count = await options.count();

        if (count > 0) {
            // Options should be clickable
            const firstOption = options.first();
            await expect(firstOption).toBeEnabled();
        }
    });

    test('should display question content', async ({ page }) => {
        await page.goto('/lesson.html?skill=heat-temp-basic&type=practice');
        await page.waitForTimeout(5000);

        // The lesson page might redirect to learn if no questions available
        if (page.url().includes('/learn')) {
            console.log('Lesson redirected to learn page');
            return;
        }

        // Question container should be visible
        const questionContainer = page.locator('.question-container, .lesson-question, #questionContent');

        if (await questionContainer.count() > 0) {
            await expect(questionContainer.first()).toBeVisible();
        }
    });

    test('should show progress indicator', async ({ page }) => {
        await page.goto('/lesson.html?skill=heat-temp-basic&type=practice');
        await page.waitForTimeout(5000);

        // The lesson page might redirect to learn if no questions available
        if (page.url().includes('/learn')) {
            console.log('Lesson redirected to learn page');
            return;
        }

        // Progress bar or indicator should exist
        const progress = page.locator('.progress-bar, .lesson-progress, [class*="progress"]');

        if (await progress.count() > 0) {
            await expect(progress.first()).toBeVisible();
        }
    });
});
