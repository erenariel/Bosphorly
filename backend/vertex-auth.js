const tokenUrl = 'https://oauth2.googleapis.com/token';
const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
const encoder = new TextEncoder();
let cached;

// JWT headers, claims and RSA signatures are small enough for a single conversion.
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function vertexAccessToken(secret, signal) {
  const now = Math.floor(Date.now() / 1000);
  if (cached?.secret === secret && cached.expires > now + 60) return cached.token;
  const account = JSON.parse(secret);
  if (account.type !== 'service_account' || !account.client_email || !account.private_key) {
    throw new Error('Invalid Vertex service account');
  }
  const pem = account.private_key.replace(/-----[^-]+-----|\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), algorithm, false, ['sign']);
  const header = { alg: 'RS256', typ: 'JWT', kid: account.private_key_id };
  const claims = { iss: account.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUrl, iat: now, exp: now + 3600 };
  const input = [header, claims].map(value => base64url(encoder.encode(JSON.stringify(value)))).join('.');
  const signature = await crypto.subtle.sign(algorithm, key, encoder.encode(input));
  const response = await fetch(tokenUrl, {
    method: 'POST', signal, redirect: 'error',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: input + '.' + base64url(new Uint8Array(signature)) }),
  });
  if (!response.ok) throw new Error('Vertex authentication failed');
  const { access_token: token, expires_in: ttl } = await response.json();
  if (typeof token !== 'string' || !token || !Number.isFinite(ttl) || ttl <= 0) throw new Error('Invalid Vertex token response');
  cached = { secret, token, expires: now + Math.min(ttl, 3600) };
  return token;
}
