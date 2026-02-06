/**
 * Local server: serves the hub and runs the Gmail API routes.
 * Run: npm start  (or node server.js)
 * Then open http://localhost:8080
 */
require('dotenv').config({ path: '.env.local' });
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// API routes (same handlers as Vercel api/*)
const authGmail = require('./api/auth/gmail');
const authGmailCallback = require('./api/auth/gmail/callback');
const authGmailSignout = require('./api/auth/gmail/signout');
const gmailInbox = require('./api/gmail/inbox');
const gmailMessage = require('./api/gmail/message');

app.get('/api/auth/gmail', (req, res) => authGmail(req, res));
app.get('/api/auth/gmail/callback', (req, res) => authGmailCallback(req, res));
app.get('/api/auth/gmail/signout', (req, res) => authGmailSignout(req, res));
app.get('/api/gmail/inbox', (req, res) => gmailInbox(req, res));
app.get('/api/gmail/message/:id', (req, res) => gmailMessage(req, res));

// Static files: root and hub
app.use(express.static(path.join(__dirname)));
app.use('/hub', express.static(path.join(__dirname, 'hub')));

// Redirect / and /hub to hub
app.get('/', (req, res) => res.redirect('/hub/'));
app.get('/hub', (req, res) => res.redirect('/hub/'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MeadBax Hub running at http://localhost:${PORT}`);
  console.log(`  Also try http://127.0.0.1:${PORT} if localhost fails`);
  console.log('  (Gmail API enabled; open Email and click Connect Gmail)');
});
