/**
 * GET/POST /api/auth/gmail/signout
 * Clears the Gmail refresh token cookie. Frontend should then reload the page.
 */
module.exports = function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear cookie (match how it was set: Path=/, HttpOnly, SameSite=Lax)
  res.setHeader('Set-Cookie', [
    'gmail_refresh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ]);

  res.status(200).json({ ok: true });
};
