/**
 * GET /api/gmail/message/:id
 * Returns a single email's headers and body. Requires valid gmail_refresh_token cookie.
 */
const { google } = require('googleapis');

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

function getHeader(headers, name) {
  if (!headers || !Array.isArray(headers)) return '';
  const h = headers.find((x) => x.name && x.name.toLowerCase() === name.toLowerCase());
  return (h && h.value) || '';
}

function decodeBody(data) {
  if (!data) return '';
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    let decoded = Buffer.from(base64, 'base64').toString('utf-8');
    if (decoded.includes('\uFFFD')) {
      decoded = Buffer.from(base64, 'base64').toString('latin1');
    }
    return decoded;
  } catch {
    return '';
  }
}

function extractBodyFromPart(part, out) {
  if (!part) return;
  const mime = (part.mimeType || '').toLowerCase();
  if (part.body && part.body.data) {
    const decoded = decodeBody(part.body.data);
    if (mime === 'text/plain') out.bodyPlain = decoded;
    else if (mime === 'text/html') out.bodyHtml = decoded;
  }
  const parts = part.parts || [];
  if (parts.length > 0) {
    for (const p of parts) extractBodyFromPart(p, out);
  }
}

function extractBody(payload) {
  const out = { bodyPlain: '', bodyHtml: '' };
  const parts = payload.parts || [];
  if (parts.length === 0) {
    if (payload.body && payload.body.data) {
      const decoded = decodeBody(payload.body.data);
      const mime = (payload.mimeType || '').toLowerCase();
      if (mime === 'text/html') out.bodyHtml = decoded;
      else out.bodyPlain = decoded;
    }
    return out;
  }
  for (const part of parts) extractBodyFromPart(part, out);
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let id = (req.params && req.params.id) || (req.query && req.query.id);
  if (!id && req.url) {
    const pathPart = req.url.split('?')[0];
    const segments = pathPart.split('/').filter(Boolean);
    if (segments[segments.length - 1] && segments[segments.length - 2] === 'message') id = segments[segments.length - 1];
  }
  if (!id) return res.status(400).json({ error: 'Missing message id' });

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
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const payload = msg.data.payload || {};
    let headers = payload.headers || [];

    if (headers.length === 0 && payload.parts && payload.parts.length > 0) {
      const first = payload.parts[0];
      if (first && first.headers && first.headers.length > 0) headers = first.headers;
    }

    const subject = getHeader(headers, 'Subject') || msg.data.snippet || '(No subject)';
    const fromRaw = getHeader(headers, 'From');
    const from = (fromRaw && fromRaw.replace(/<[^>]+>/g, '').trim()) || fromRaw || '';
    const dateHeader = getHeader(headers, 'Date');
    let date = '';
    try {
      if (dateHeader) {
        const d = new Date(dateHeader);
        date = d.toLocaleString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch {
      date = dateHeader || '';
    }

    const { bodyPlain, bodyHtml } = extractBody(payload);
    const body = bodyHtml || bodyPlain;
    const snippet = (msg.data.snippet && String(msg.data.snippet).trim()) || '';

    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).json({
      id: msg.data.id,
      subject,
      from,
      date,
      bodyPlain,
      bodyHtml,
      body,
      snippet,
    });
  } catch (err) {
    if (err.code === 404) return res.status(404).json({ error: 'Message not found' });
    return res.status(500).json({ error: 'Failed to fetch message', message: err.message });
  }
};
