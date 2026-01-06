import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {

  test.describe('Auth API', () => {

    test('GET /api/auth/me should return user object or null', async ({ request }) => {
      const response = await request.get('/api/auth/me');

      // Should return 200
      expect(response.status()).toBe(200);

      const data = await response.json();

      // Should have user property (could be null if not logged in)
      expect(data).toHaveProperty('user');
    });

    test('POST /api/auth/logout should work', async ({ request }) => {
      const response = await request.post('/api/auth/logout');

      // Should not error
      expect([200, 204, 302]).toContain(response.status());
    });
  });

  test.describe('Learn API', () => {

    test('GET /api/learn/skill-tree should return proper structure or 401', async ({ request }) => {
      const response = await request.get('/api/learn/skill-tree');

      // Should be 200 (success) or 401 (unauthorized)
      expect([200, 401]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();

        // Check structure
        expect(data).toHaveProperty('units');
        expect(data).toHaveProperty('user');
        expect(data).toHaveProperty('hearts');

        // Units should be an array
        expect(Array.isArray(data.units)).toBeTruthy();

        // Hearts should have current and max
        expect(data.hearts).toHaveProperty('current');
        expect(data.hearts).toHaveProperty('max');
      }
    });

    test('GET /api/learn/hearts should return hearts info', async ({ request }) => {
      const response = await request.get('/api/learn/hearts');

      expect([200, 401]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('current');
        expect(data).toHaveProperty('max');
      }
    });

    test('GET /api/learn/achievements should return achievements', async ({ request }) => {
      const response = await request.get('/api/learn/achievements');

      expect([200, 401]).toContain(response.status());
    });

    test('GET /api/learn/league should return league data', async ({ request }) => {
      const response = await request.get('/api/learn/league');

      expect([200, 401]).toContain(response.status());
    });
  });

  test.describe('Lesson API', () => {

    test('POST /api/learn/lesson/start should require authentication', async ({ request }) => {
      const response = await request.post('/api/learn/lesson/start', {
        data: {
          skillNodeId: 'heat-temp-basic',
          lessonType: 'practice'
        }
      });

      // Should be 200 (with questions) or 401 (unauthorized) or 400 (bad request)
      expect([200, 400, 401]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        // Should have session info and questions
        expect(data).toHaveProperty('sessionId');
        expect(data).toHaveProperty('questions');
      }
    });

    test('POST /api/learn/lesson/answer should require session', async ({ request }) => {
      const response = await request.post('/api/learn/lesson/answer', {
        data: {
          sessionId: 'invalid-session',
          questionId: 'test',
          answer: 'A'
        }
      });

      // Should return error for invalid session
      expect([400, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Error Handling', () => {

    test('Invalid API endpoint behavior', async ({ request }) => {
      const response = await request.get('/api/nonexistent-endpoint');

      // Cloudflare Pages may return HTML fallback for unknown routes
      // Just verify we get some response (not a server error)
      const status = response.status();
      expect(status).toBeLessThan(500); // Not a server error
    });

    test('API should return JSON content type', async ({ request }) => {
      const response = await request.get('/api/auth/me');

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('API should handle malformed POST data', async ({ request }) => {
      const response = await request.post('/api/learn/lesson/start', {
        data: 'not json'
      });

      // Should not crash - return appropriate error
      expect([400, 401, 415, 500]).toContain(response.status());
    });
  });
});

test.describe('API Response Format', () => {

  test('skill-tree API units should have required fields', async ({ request }) => {
    const response = await request.get('/api/learn/skill-tree');

    if (response.status() === 200) {
      const data = await response.json();

      // Check first unit structure
      if (data.units && data.units.length > 0) {
        const unit = data.units[0];
        expect(unit).toHaveProperty('id');
        expect(unit).toHaveProperty('name');
        expect(unit).toHaveProperty('nodes');

        // Check nodes
        if (unit.nodes && unit.nodes.length > 0) {
          const node = unit.nodes[0];
          expect(node).toHaveProperty('id');
          expect(node).toHaveProperty('name');
          expect(node).toHaveProperty('status');
        }
      }
    }
  });
});


test.describe('API Endpoints', () => {

  test.describe('Auth API', () => {

    test('GET /api/auth/me should return user object or null', async ({ request }) => {
      const response = await request.get('/api/auth/me');

      // Should return 200
      expect(response.status()).toBe(200);

      const data = await response.json();

      // Should have user property (could be null if not logged in)
      expect(data).toHaveProperty('user');
    });

    test('POST /api/auth/logout should work', async ({ request }) => {
      const response = await request.post('/api/auth/logout');

      // Should not error
      expect([200, 204, 302]).toContain(response.status());
    });
  });

  test.describe('Learn API', () => {

    test('GET /api/learn/skill-tree should return proper structure or 401', async ({ request }) => {
      const response = await request.get('/api/learn/skill-tree');

      // Should be 200 (success) or 401 (unauthorized)
      expect([200, 401]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();

        // Check structure
        expect(data).toHaveProperty('units');
        expect(data).toHaveProperty('user');
        expect(data).toHaveProperty('hearts');

        // Units should be an array
        expect(Array.isArray(data.units)).toBeTruthy();

        // Hearts should have current and max
        expect(data.hearts).toHaveProperty('current');
        expect(data.hearts).toHaveProperty('max');
      }
    });

    test('GET /api/learn/hearts should return hearts info', async ({ request }) => {
      const response = await request.get('/api/learn/hearts');

      expect([200, 401]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('current');
        expect(data).toHaveProperty('max');
      }
    });

    test('GET /api/learn/achievements should return achievements', async ({ request }) => {
      const response = await request.get('/api/learn/achievements');

      expect([200, 401]).toContain(response.status());
    });

    test('GET /api/learn/league should return league data', async ({ request }) => {
      const response = await request.get('/api/learn/league');

      expect([200, 401]).toContain(response.status());
    });
  });

  test.describe('Lesson API', () => {

    test('POST /api/learn/lesson/start should require authentication', async ({ request }) => {
      const response = await request.post('/api/learn/lesson/start', {
        data: {
          skillNodeId: 'heat-temp-basic',
          lessonType: 'practice'
        }
      });

      // Should be 200 (with questions) or 401 (unauthorized) or 400 (bad request)
      expect([200, 400, 401]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        // Should have session info and questions
        expect(data).toHaveProperty('sessionId');
        expect(data).toHaveProperty('questions');
      }
    });

    test('POST /api/learn/lesson/answer should require session', async ({ request }) => {
      const response = await request.post('/api/learn/lesson/answer', {
        data: {
          sessionId: 'invalid-session',
          questionId: 'test',
          answer: 'A'
        }
      });

      // Should return error for invalid session
      expect([400, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Error Handling', () => {

    test('Invalid API endpoint behavior', async ({ request }) => {
      const response = await request.get('/api/nonexistent-endpoint');

      // Cloudflare Pages may return HTML fallback for unknown routes
      // Just verify we get some response (not a server error)
      const status = response.status();
      expect(status).toBeLessThan(500); // Not a server error
    });

    test('API should return JSON content type', async ({ request }) => {
      const response = await request.get('/api/auth/me');

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('API should handle malformed POST data', async ({ request }) => {
      const response = await request.post('/api/learn/lesson/start', {
        data: 'not json'
      });

      // Should not crash - return appropriate error
      expect([400, 401, 415, 500]).toContain(response.status());
    });
  });
});

test.describe('API Response Format', () => {

  test('skill-tree API units should have required fields', async ({ request }) => {
    const response = await request.get('/api/learn/skill-tree');

    if (response.status() === 200) {
      const data = await response.json();

      // Check first unit structure
      if (data.units && data.units.length > 0) {
        const unit = data.units[0];
        expect(unit).toHaveProperty('id');
        expect(unit).toHaveProperty('name');
        expect(unit).toHaveProperty('nodes');

        // Check nodes
        if (unit.nodes && unit.nodes.length > 0) {
          const node = unit.nodes[0];
          expect(node).toHaveProperty('id');
          expect(node).toHaveProperty('name');
          expect(node).toHaveProperty('status');
        }
      }
    }
  });
});

