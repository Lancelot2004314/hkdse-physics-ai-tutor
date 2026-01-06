/**
 * Global Setup for Playwright Tests
 * Registers a test user before running tests
 */

import { request } from '@playwright/test';

// Test user credentials - consistent across all tests
export const TEST_EMAIL = 'playwright-e2e-test@test.com';
export const TEST_PASSWORD = 'PlaywrightTest123!';
export const TEST_NAME = 'E2E Test User';

const BASE_URL = 'https://hkdse-physics-ai-tutor.pages.dev';

async function globalSetup() {
    console.log('🔧 Global Setup: Registering test user...');

    const context = await request.newContext({
        baseURL: BASE_URL,
    });

    try {
        // Try to register a test user
        const registerResponse = await context.post('/api/auth/register', {
            data: {
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
                name: TEST_NAME,
            },
        });

        const registerData = await registerResponse.json();

        if (registerResponse.ok()) {
            console.log('✅ Test user registered successfully');
        } else if (registerData.error?.includes('已注册') || registerData.error?.includes('already')) {
            console.log('ℹ️ Test user already exists, will use for login tests');
        } else {
            console.log('⚠️ Registration response:', registerData);
        }

        // Verify the user can login
        const loginResponse = await context.post('/api/auth/email/login', {
            data: {
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
            },
        });

        if (loginResponse.ok()) {
            console.log('✅ Test user login verified');
        } else {
            const loginData = await loginResponse.json();
            console.log('⚠️ Login verification failed:', loginData);
        }

    } catch (error) {
        console.error('❌ Global setup error:', error);
        // Don't throw - let tests handle auth failures
    } finally {
        await context.dispose();
    }
}

export default globalSetup;

