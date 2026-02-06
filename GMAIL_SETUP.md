# Gmail integration setup

The hub can show your real Gmail inbox in the **Email** section. To enable it you need a Google Cloud project and to run the app with a small API (e.g. Vercel).

## 1. Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project or pick an existing one.
3. **Enable the Gmail API**: APIs & Services → Library → search “Gmail API” → Enable.
4. **Create OAuth credentials**:
   - APIs & Services → Credentials → Create credentials → OAuth client ID.
   - If asked, configure the OAuth consent screen (External, add your email as test user).
   - Application type: **Web application**.
   - Name it (e.g. “MeadBax Hub”).
   - **Authorized JavaScript origins** (no path—origin only):
     - Local: `http://localhost:3000`
     - Production: `https://YOUR_DOMAIN.vercel.app`
   - **Authorized redirect URIs** (full URL with path):
     - Local: `http://localhost:3000/api/auth/gmail/callback`
     - Production: `https://YOUR_DOMAIN.vercel.app/api/auth/gmail/callback`
5. Copy the **Client ID** and **Client secret**; you’ll use them as env vars.

**Allow more Gmail addresses (Testing mode):** If your app is in **Testing** status, only accounts listed as **Test users** can sign in. To allow another address: **APIs & Services** → **OAuth consent screen** → scroll to **Test users** → **+ ADD USERS** → add the Gmail address → Save. To allow any Gmail user without adding each one, you’d need to **Publish** the app (and may need to complete Google’s verification for sensitive scopes).

## 2. Environment variables

Set these where the API runs (e.g. Vercel project settings):

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID from the Google Cloud console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client secret |
| `BASE_URL` | Full URL of your app (no trailing slash), e.g. `https://your-app.vercel.app` or `http://localhost:3000` for local |

## 3. Run locally (with API)

1. Install dependencies: `npm install`
2. Create a `.env` or `.env.local` in the project root with:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   BASE_URL=http://localhost:3000
   ```
3. Run with Vercel CLI so the API routes work:
   ```bash
   npx vercel dev
   ```
4. Open `http://localhost:3000/hub` (or the URL shown).
5. In the Email section click **Connect Gmail**, sign in with Google, and allow access. Your inbox will load.

## 4. Deploy to Vercel

1. Push your code and import the repo in [Vercel](https://vercel.com).
2. In the project settings, add the env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BASE_URL` (your production URL, e.g. `https://your-project.vercel.app`).
3. Add the production callback URL (from step 1.4) in the Google Cloud redirect URIs.
4. Deploy. Open `https://your-project.vercel.app/hub`, then Connect Gmail in the Email section.

## 5. Without the API (static only)

If you only serve the `hub` folder (e.g. plain static host or `python -m http.server`), there is no API. The Email section will show “Connect Gmail” and a message that the server cannot be reached. Gmail integration only works when the app is run with the API (e.g. `vercel dev` or deployed on Vercel).

## Privacy and security

- Only **you** connect **your** Gmail; the app uses read-only scope (`gmail.readonly`).
- The refresh token is stored in an **HttpOnly cookie** so JavaScript cannot read it; only your API can use it to fetch emails.
- Do not commit `.env` or share your client secret.

**Showing email content:** HTML bodies are rendered in a **sandboxed iframe** (no scripts run). Plain text is shown with `textContent` so it cannot execute code. Links inside HTML emails still work; be cautious with links in emails (phishing). The app does not sanitize HTML—it is your own mailbox, but if you forward or open untrusted messages, treat links and content with normal care.
