/**
 * GET /api/auth/gmail/callback
 * Handles OAuth callback from Google, exchanges code for tokens, sets refresh token in cookie.
 */
const COOKIE_OPTIONS = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'; // 30 days

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state } = req.query || {};
  const cookies = parseCookies(req.headers.cookie);
  const storedState = cookies.gmail_oauth_state;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');

  if (!code || !clientId || !clientSecret) {
    return redirectToHub(res, baseUrl, false);
  }
  if (state !== storedState) {
    return redirectToHub(res, baseUrl, false);
  }

  const redirectUri = `${baseUrl}/api/auth/gmail/callback`;
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  let data;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    data = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(data.error || 'Token exchange failed');
  } catch (err) {
    return redirectToHub(res, baseUrl, false);
  }

  const refreshToken = data.refresh_token;
  if (!refreshToken) return redirectToHub(res, baseUrl, false);

  const secure = baseUrl.startsWith('https');
  const cookie = `gmail_refresh_token=${encodeURIComponent(refreshToken)}; ${COOKIE_OPTIONS}${secure ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', [cookie, 'gmail_oauth_state=; Path=/; Max-Age=0']);
  redirectToHub(res, baseUrl, true);
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((part) => {
    const [key, ...v] = part.trim().split('=');
    if (key) out[key] = (v.join('=') || '').trim();
  });
  return out;
}

function redirectToHub(res, baseUrl, success) {
  const path = baseUrl ? `${baseUrl}/hub/` : '/hub/';
  const url = `${path}${success ? '?gmail=connected' : '?gmail=error'}`;
  res.redirect(302, url);
}
