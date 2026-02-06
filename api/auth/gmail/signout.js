/**
 * GET /api/auth/gmail/signout
 * Clears the Gmail refresh token cookie and returns JSON so the client can update the UI
 * (clear inbox, show "Connect Gmail") without leaving the page.
 */
module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clearCookie =
    'gmail_refresh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  res.setHeader('Set-Cookie', clearCookie);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).json({ ok: true });
};
