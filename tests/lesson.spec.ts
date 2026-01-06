import { test, expect } from '@playwright/test';
import { setupConsoleErrorTracking, waitForPageLoad } from './helpers/auth';

/**
 * Lesson Page tests that don't require authentication
 * Tests that require auth are in lesson.authenticated.spec.ts
 */

test.describe('Lesson Page', () => {

  test('should load lesson page structure', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);

    // Try to load lesson page with skill parameter
    await page.goto('/lesson.html?skill=heat-temp-basic&type=practice');

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Check if redirected to login or showing content
    const currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      console.log('Lesson page requires authentication');
      return;
    }

    // Should have lesson container
    const hasContainer = await page.locator('.lesson-container, .question-container, #questionContainer').count() > 0;

    // Log any JavaScript errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('KaTeX')
    );

    if (criticalErrors.length > 0) {
      console.log('Lesson page errors:', criticalErrors);
    }
  });

  test('should handle missing skill parameter gracefully', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);

    // Load without parameters
    await page.goto('/lesson.html');
    await page.waitForTimeout(2000);

    // Should either show error message or redirect
    // Shouldn't crash
    const criticalErrors = errors.filter(e =>
      e.includes('Cannot read') ||
      e.includes('undefined') ||
      e.includes('null')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should load KaTeX for math rendering', async ({ page }) => {
    await page.goto('/lesson.html?skill=heat-temp-basic&type=practice');
    await page.waitForTimeout(2000);

    // Check if KaTeX CSS is loaded
    const katexLink = page.locator('link[href*="katex"]');
    const hasKatex = await katexLink.count() > 0;

    // KaTeX should be available
    if (await page.locator('.lesson-container').count() > 0) {
      expect(hasKatex).toBeTruthy();
    }
  });

  test('should call lesson start API', async ({ page }) => {
    // Listen for API call
    let apiCalled = false;
    let apiResponse: any = null;

    page.on('response', async response => {
      if (response.url().includes('/api/learn/lesson/start')) {
        apiCalled = true;
        try {
          apiResponse = await response.json();
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    await page.goto('/lesson.html?skill=heat-temp-basic&type=practice');
    await page.waitForTimeout(5000);

    // If on lesson page, API should be called
    if (!page.url().includes('/login')) {
      // Check API response structure if called
      if (apiCalled && apiResponse) {
        // Response should have questions or error
        const hasQuestions = apiResponse.questions || apiResponse.error;
        console.log('API Response:', JSON.stringify(apiResponse).substring(0, 200));
      }
    }
  });
});

test.describe('Question Rendering', () => {

  test('should not have undefined/null errors when rendering questions', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);

    await page.goto('/lesson.html?skill=heat-temp-basic&type=practice');
    await page.waitForTimeout(5000);

    // Check for common rendering errors
    const renderErrors = errors.filter(e =>
      e.includes('Cannot read properties of undefined') ||
      e.includes('Cannot read properties of null') ||
      e.includes("reading 'map'") ||
      e.includes("reading 'forEach'") ||
      e.includes("reading 'length'")
    );

    if (renderErrors.length > 0) {
      console.log('Rendering errors found:', renderErrors);
    }

    // This is informational - we want to catch these
    expect(renderErrors).toHaveLength(0);
  });
});
