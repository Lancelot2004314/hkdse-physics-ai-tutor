import { Page } from '@playwright/test';

// Import test credentials from global setup
import { TEST_EMAIL, TEST_PASSWORD, TEST_NAME } from '../global-setup';

// Re-export for convenience
export { TEST_EMAIL, TEST_PASSWORD, TEST_NAME };

// Legacy export for backwards compatibility
export const TEST_USER = {
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  name: TEST_NAME,
};

/**
 * Login helper - performs email/password login
 * Handles the tab switching required for email login
 */
export async function login(page: Page, email?: string, password?: string): Promise<boolean> {
  const userEmail = email || TEST_EMAIL;
  const userPassword = password || TEST_PASSWORD;

  try {
    await page.goto('/login.html');

    // Wait for the login container to load
    await page.waitForSelector('.login-container', { timeout: 5000 });

    // Click the Email tab first (Google is default)
    const emailTab = page.locator('.login-tab[data-tab="email"]');
    await emailTab.click();
    await page.waitForTimeout(300);

    // Wait for email input to be visible
    await page.waitForSelector('#emailInput', { timeout: 5000 });

    // Fill in credentials
    await page.fill('#emailInput', userEmail);
    await page.fill('#passwordInput', userPassword);

    // Click the email login button
    await page.click('#emailLoginBtn');

    // Wait for navigation away from login page
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });

    return true;
  } catch (error) {
    console.error('Login failed:', error);
    return false;
  }
}

/**
 * Check if user is logged in by checking API response
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get('/api/auth/me');
    if (response.ok()) {
      const data = await response.json();
      return !!data.user;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Logout helper
 */
export async function logout(page: Page): Promise<void> {
  try {
    await page.request.post('/api/auth/logout');
  } catch {
    // Ignore errors
  }
}

/**
 * Wait for page to be fully loaded (no pending network requests)
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * Check for console errors on page
 */
export function setupConsoleErrorTracking(page: Page): string[] {
  const errors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
  });

  return errors;
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(page: Page, urlPattern: string | RegExp): Promise<any> {
  const response = await page.waitForResponse(
    resp => {
      if (typeof urlPattern === 'string') {
        return resp.url().includes(urlPattern);
      }
      return urlPattern.test(resp.url());
    },
    { timeout: 10000 }
  );

  try {
    return await response.json();
  } catch {
    return null;
  }
}
