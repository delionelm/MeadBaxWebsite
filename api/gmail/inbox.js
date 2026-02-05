/**
 * GET /api/gmail/inbox
 * Returns recent emails from Gmail. Requires valid gmail_refresh_token cookie.
 */
const { google } = require('googleapis');

const MAX_RESULTS = 20;

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((part) => {
    const [key, ...v] = part.trim().split('=');
    if (key) out[key] = (v.join('=') || '').trim();
  });
  return out;
}

function getRefreshToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies.gmail_refresh_token;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const refreshToken = getRefreshToken(req);
  if (!refreshToken) {
    return res.status(401).json({ error: 'Not connected', code: 'NOT_CONNECTED' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Gmail not configured' });
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, '');
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  let gmail;
  try {
    const auth = await oauth2Client.getAccessToken();
    if (!auth.token) throw new Error('No access token');
    gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'NOT_CONNECTED' });
  }

  try {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: MAX_RESULTS,
      q: 'in:inbox',
    });
    const messages = listRes.data.messages || [];
    const emails = [];

    for (let i = 0; i < Math.min(messages.length, 15); i++) {
      const msg = await gmail.users.messages.get({ userId: 'me', id: messages[i].id });
      const payload = msg.data.payload || {};
      const headers = payload.headers || [];
      const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject');
      const from = getHeader('From').replace(/<[^>]+>/g, '').trim() || getHeader('From');
      const dateHeader = getHeader('Date');
      let time = '';
      try {
        const d = new Date(dateHeader);
        const now = new Date();
        const diff = now - d;
        if (diff < 86400000) time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        else if (diff < 172800000) time = 'Yesterday';
        else time = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } catch {
        time = dateHeader || '';
      }

      emails.push({ id: msg.data.id, subject: subject || '(No subject)', sender: from, time });
    }

    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).json({ emails });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch inbox', message: err.message });
  }
}
