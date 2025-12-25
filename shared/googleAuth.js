/**
 * Google Cloud Authentication for Cloudflare Workers
 * Generates OAuth2 access tokens from Service Account JSON
 */

// Token cache (in-memory, per worker instance)
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get OAuth2 access token for Google Cloud APIs
 * Uses Service Account JSON to generate JWT and exchange for access token
 * @param {object} env - Environment with GCP_SERVICE_ACCOUNT_JSON
 * @returns {Promise<string>} - Access token
 */
export async function getGoogleAccessToken(env) {
  // Check cache
  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 60000) {
    return cachedToken;
  }

  // Parse service account JSON
  let serviceAccount;
  try {
    serviceAccount = typeof env.GCP_SERVICE_ACCOUNT_JSON === 'string'
      ? JSON.parse(env.GCP_SERVICE_ACCOUNT_JSON)
      : env.GCP_SERVICE_ACCOUNT_JSON;
  } catch (err) {
    throw new Error('Invalid GCP_SERVICE_ACCOUNT_JSON: ' + err.message);
  }

  if (!serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('GCP_SERVICE_ACCOUNT_JSON missing required fields');
  }

  // Create JWT
  const jwtHeader = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const nowSeconds = Math.floor(now / 1000);
  const jwtPayload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600, // 1 hour
    scope: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/devstorage.read_write',
    ].join(' '),
  };

  // Sign JWT
  const jwt = await signJwt(jwtHeader, jwtPayload, serviceAccount.private_key);

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error('Failed to get access token: ' + error);
  }

  const tokenData = await tokenResponse.json();

  // Cache token
  cachedToken = tokenData.access_token;
  tokenExpiry = now + (tokenData.expires_in * 1000);

  return cachedToken;
}

/**
 * Sign JWT using RS256 (RSA-SHA256)
 */
async function signJwt(header, payload, privateKeyPem) {
  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const privateKey = await importPrivateKey(privateKeyPem);

  // Sign
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = base64UrlEncode(signature);
  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Import PEM private key for Web Crypto API
 */
async function importPrivateKey(pem) {
  // Remove PEM headers and decode
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

/**
 * Base64 URL encode (no padding, URL-safe characters)
 */
function base64UrlEncode(input) {
  let base64;
  if (typeof input === 'string') {
    base64 = btoa(input);
  } else {
    // ArrayBuffer
    base64 = btoa(String.fromCharCode(...new Uint8Array(input)));
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Get GCP configuration from environment
 */
export function getGcpConfig(env) {
  return {
    projectId: env.GCP_PROJECT_ID,
    location: env.GCP_LOCATION || 'us-central1',
    bucketName: env.GCS_BUCKET_NAME,
    corpusId: env.VERTEX_RAG_CORPUS_ID,
  };
}
