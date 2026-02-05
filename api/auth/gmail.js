/**
 * GET /api/auth/gmail
 * Redirects user to Google OAuth consent screen.
 * Requires env: GOOGLE_CLIENT_ID, BASE_URL (e.g. https://your-app.vercel.app)
 */
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
  if (!clientId) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' });
  }

  const redirectUri = `${baseUrl}/api/auth/gmail/callback`;
  const state = Math.random().toString(36).slice(2);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  res.setHeader('Set-Cookie', `gmail_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
