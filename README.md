# Daily Hub

A single-page hub that tracks your **tasks** and **goals**, shows **weather** and **date**, and uses **AI** (or built-in logic) to suggest what to do today based on everything combined.

## What’s in the hub

- **Date & time** — Current date, time, and “day of year” / week.
- **Weather** — Live conditions via [Open-Meteo](https://open-meteo.com/) (no API key). Uses your location if you allow it, otherwise a default.
- **Tasks** — Add, complete, and remove to-dos. Stored in your browser (localStorage).
- **Goals** — Same for longer-term goals.
- **Today’s suggestion** — Either:
  - **With OpenAI**: If you add an API key in Settings, the hub sends your tasks, goals, weather, and date to OpenAI and shows a short suggestion.
  - **Without API key**: Built-in logic still suggests what to focus on using your tasks, goals, weather, and time of day.

## Run locally

1. Open the project folder.
2. Serve the files over HTTP (required for geolocation and external APIs). For example:
   - **Python 3**: `python -m http.server 8000`
   - **Node**: `npx serve .`
3. Open `http://localhost:8000` (or the port you used) in your browser.

## Optional: OpenAI for AI suggestions

1. Click the **⚙** (settings) button in the top-right.
2. Paste your [OpenAI API key](https://platform.openai.com/api-keys) (stored only in your browser).
3. Click **Save** and use **Refresh suggestion** to get an AI-generated suggestion.

Without a key, the hub still gives suggestions using your tasks, goals, and weather.

## Files

- `index.html` — Layout and sections.
- `styles.css` — Styling.
- `app.js` — Date/time, weather fetch, todos, goals, and AI/built-in suggestion logic.

No build step; use any static host to deploy.
