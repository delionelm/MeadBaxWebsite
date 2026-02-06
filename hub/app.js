/* MeadBax Hub — App logic */

const STORAGE_KEYS = {
  notes: 'hub_notes',
  events: 'hub_events',
  location: 'hub_location',
  units: 'hub_units',
};

const API_BASE = ''; // same origin when hub is served with API (e.g. Vercel)

const QUOTES = [
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'Don’t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'Great things are done by a series of small things brought together.', author: 'Vincent van Gogh' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Your time is limited, so don’t waste it living someone else’s life.', author: 'Steve Jobs' },
  { text: 'Dreams don’t work unless you do.', author: 'John C. Maxwell' },
  { text: 'It always seems impossible until it’s done.', author: 'Nelson Mandela' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
  { text: 'Small steps every day.', author: 'Anonymous' },
];

// ——— Date & time ———
function formatDate(d) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return d.toLocaleDateString(undefined, options);
}

function formatTime(d) {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getDayMeta(d) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOfYear = Math.floor((start - new Date(d.getFullYear(), 0, 0)) / 86400000);
  const weekNum = Math.ceil((start - new Date(d.getFullYear(), 0, 1)) / 604800000) + 1;
  return `Day ${dayOfYear} of the year · Week ${weekNum}`;
}

function updateDateTime() {
  const now = new Date();
  const dateEl = document.getElementById('dateText');
  const timeEl = document.getElementById('timeText');
  const metaEl = document.getElementById('dayMeta');
  if (dateEl) dateEl.textContent = formatDate(now);
  if (timeEl) timeEl.textContent = formatTime(now);
  if (metaEl) metaEl.textContent = getDayMeta(now);
}

function getDailyQuoteIndex() {
  const today = new Date();
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 997;
  }
  return hash % QUOTES.length;
}

function renderQuoteOfTheDay() {
  const quote = QUOTES[getDailyQuoteIndex()];
  const textEl = document.getElementById('quoteText');
  const authorEl = document.getElementById('quoteAuthor');
  if (textEl) textEl.textContent = `“${quote.text}”`;
  if (authorEl) authorEl.textContent = `— ${quote.author}`;
}

// ——— Weather (Open-Meteo, no API key) ———
async function fetchWeather(options = {}) {
  const loading = document.getElementById('weatherLoading');
  const details = document.getElementById('weatherDetails');
  const tempEl = document.getElementById('weatherTemp');
  const descEl = document.getElementById('weatherDesc');
  const metaEl = document.getElementById('weatherMeta');
  const extraEl = document.getElementById('weatherExtra');
  const cityEl = document.getElementById('weatherCity');
  const highLowEl = document.getElementById('weatherHighLow');
  const hourlyList = document.getElementById('hourlyList');
  const dailyList = document.getElementById('dailyList');
  const feelsLikeEl = document.getElementById('feelsLike');
  const windSpeedEl = document.getElementById('windSpeed');
  const uvIndexEl = document.getElementById('uvIndex');
  const sunriseEl = document.getElementById('sunriseTime');
  const sunsetEl = document.getElementById('sunsetTime');
  const precipEl = document.getElementById('precipSum');
  const aqiScoreEl = document.getElementById('aqiScore');
  const aqiLabelEl = document.getElementById('aqiLabel');
  const aqiMetaEl = document.getElementById('aqiMeta');

  const defaultLat = 38.8048;
  const defaultLon = -77.0469;
  const units = getUnits();

  function success(pos) {
    const label = 'Current location';
    saveLocation({ label, lat: pos.coords.latitude, lon: pos.coords.longitude });
    fetchWithCoords(pos.coords.latitude, pos.coords.longitude, label);
  }

  function error() {
    const saved = getSavedLocation();
    if (saved) {
      fetchWithCoords(saved.lat, saved.lon, saved.label);
      return;
    }
    fetchWithCoords(defaultLat, defaultLon, 'Alexandria, VA');
  }

  async function fetchWithCoords(lat, lon, label = 'Current location') {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_sum&temperature_unit=${units.temp}&windspeed_unit=${units.wind}&precipitation_unit=${units.precip}&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.reason || 'Weather fetch failed');

      const cur = data.current;
      const temp = Math.round(cur.temperature_2m);
      const desc = weatherCodeToDesc(cur.weather_code);
      const meta = `Humidity ${cur.relative_humidity_2m}% · Wind ${Math.round(cur.wind_speed_10m)} km/h`;
      const timeZone = data.timezone;
      const offsetSeconds = data.utc_offset_seconds;

      if (loading) loading.classList.add('hidden');
      if (details) details.classList.remove('hidden');
      if (tempEl) tempEl.textContent = `${temp}°${units.temp === 'fahrenheit' ? 'F' : 'C'}`;
      if (descEl) descEl.textContent = desc;
      if (metaEl) metaEl.textContent = meta;
      if (cityEl) cityEl.textContent = label;
      if (highLowEl) {
        const high = Math.round(data.daily.temperature_2m_max[0]);
        const low = Math.round(data.daily.temperature_2m_min[0]);
        highLowEl.textContent = `H:${high}°  L:${low}°`;
      }
      if (feelsLikeEl) {
        feelsLikeEl.textContent = `${Math.round(cur.apparent_temperature)}°${
          units.temp === 'fahrenheit' ? 'F' : 'C'
        }`;
      }
      if (windSpeedEl) {
        windSpeedEl.textContent = `${Math.round(cur.wind_speed_10m)} ${
          units.wind === 'mph' ? 'mph' : 'km/h'
        }`;
      }
      if (uvIndexEl) uvIndexEl.textContent = `${Math.round(data.daily.uv_index_max[0])}`;
      const sunriseText = formatTimeInZone(data.daily.sunrise[0], timeZone, offsetSeconds);
      const sunsetText = formatTimeInZone(data.daily.sunset[0], timeZone, offsetSeconds);
      if (sunriseEl) {
        sunriseEl.textContent = sunriseText;
      }
      if (sunsetEl) {
        sunsetEl.textContent = sunsetText;
      }
      if (precipEl) {
        const precipValue = data.daily.precipitation_sum[0];
        precipEl.textContent = `${Math.round(precipValue * 10) / 10} ${
          units.precip === 'inch' ? 'in' : 'mm'
        }`;
      }
      if (extraEl) {
        extraEl.textContent = `Last updated ${new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`;
      }

      window.__hubWeather = { temp, desc, code: cur.weather_code };
      window.__hubWeatherTimezone = { timeZone, offsetSeconds };
      renderHourly(data.hourly, hourlyList, timeZone, offsetSeconds, {
        sunrise: sunriseText,
        sunset: sunsetText,
      });
      renderDaily(data.daily, dailyList, units);
      fetchAirQuality(lat, lon, aqiScoreEl, aqiLabelEl, aqiMetaEl);
    } catch (e) {
      if (loading) loading.textContent = 'Weather unavailable';
      if (loading) loading.classList.remove('hidden');
      if (details) details.classList.add('hidden');
      if (extraEl) extraEl.textContent = '';
      if (hourlyList) hourlyList.innerHTML = '';
      if (dailyList) dailyList.innerHTML = '';
      if (aqiScoreEl) aqiScoreEl.textContent = '—';
      if (aqiLabelEl) aqiLabelEl.textContent = '—';
      if (aqiMetaEl) aqiMetaEl.textContent = '';
      window.__hubWeather = null;
    }
  }

  if (options.location) {
    const { lat, lon, label } = options.location;
    saveLocation({ lat, lon, label });
    fetchWithCoords(lat, lon, label);
    return;
  }

  if (options.useSavedOnly) {
    error();
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(success, error, { timeout: 5000 });
  } else {
    error();
  }
}

function weatherCodeToDesc(code) {
  const map = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    51: 'Light drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    80: 'Rain showers',
    95: 'Thunderstorm',
  };
  return map[code] || 'Unknown';
}

function renderHourly(hourly, container, timeZone, offsetSeconds, sunTimes = {}) {
  if (!container || !hourly?.time) return;
  const nowUtc = Date.now();
  const zoneHourStartUtc = getZoneHourStartUtc(nowUtc, offsetSeconds);
  const items = hourly.time.map((time, idx) => ({
    utcMillis: parseLocalTimeToUtcMillis(time, offsetSeconds),
    temp: hourly.temperature_2m[idx],
  }));
  const startIndex = items.findIndex((entry) => entry.utcMillis >= zoneHourStartUtc);
  const future = (startIndex >= 0 ? items.slice(startIndex) : items).slice(0, 24);

  if (!future.length) {
    container.innerHTML = '';
    return;
  }

  const specials = [];
  if (sunTimes.sunrise) {
    specials.push({ label: 'Sunrise', time: sunTimes.sunrise, type: 'sun' });
  }
  if (sunTimes.sunset) {
    specials.push({ label: 'Sunset', time: sunTimes.sunset, type: 'sun' });
  }

  container.innerHTML = future
    .map((entry, idx) => {
      const label = idx === 0 ? 'Now' : formatHourLabel(entry.utcMillis, timeZone);
      return `
      <div class="hourly-item">
        <span>${label}</span>
        <strong>${Math.round(entry.temp)}°</strong>
      </div>
    `;
    })
    .concat(
      specials.map(
        (item) => `
      <div class="hourly-item hourly-sun">
        <span>${item.label}</span>
        <strong>${item.time}</strong>
      </div>
    `
      )
    )
    .join('');
}

function renderDaily(daily, container, units) {
  if (!container || !daily?.time) return;
  const dates = daily.time.map((date, idx) => ({
    date,
    index: idx,
  }));
  const todayStr = new Date().toISOString().slice(0, 10);
  const startIndex = Math.max(
    0,
    dates.findIndex((item) => item.date >= todayStr)
  );
  const slice = dates.slice(startIndex, startIndex + 10);

  container.innerHTML = slice
    .map(({ date, index }) => {
      const high = Math.round(daily.temperature_2m_max[index]);
      const low = Math.round(daily.temperature_2m_min[index]);
      const label = new Date(date).toLocaleDateString(undefined, { weekday: 'short' });
      return `
        <li class="list-item">
          <h4>${label}</h4>
          <p>${weatherCodeToDesc(daily.weather_code[index])}</p>
          <span class="meta">H:${high}° L:${low}°</span>
        </li>
      `;
    })
    .join('');
}

async function fetchAirQuality(lat, lon, scoreEl, labelEl, metaEl) {
  if (!scoreEl || !labelEl || !metaEl) return;
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,ozone`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error('Air quality unavailable');
    const aqi = Math.round(data.current.us_aqi);
    const { label, color } = aqiLabel(aqi);
    scoreEl.textContent = `${aqi}`;
    scoreEl.style.color = color;
    labelEl.textContent = label;
    metaEl.textContent = `PM2.5 ${Math.round(data.current.pm2_5)} · PM10 ${Math.round(
      data.current.pm10
    )}`;
  } catch (err) {
    scoreEl.textContent = '—';
    labelEl.textContent = 'Unavailable';
    metaEl.textContent = '';
  }
}

function aqiLabel(value) {
  if (value <= 50) return { label: 'Good', color: '#2f8f6f' };
  if (value <= 100) return { label: 'Moderate', color: '#d6a92c' };
  if (value <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#e0762a' };
  if (value <= 200) return { label: 'Unhealthy', color: '#c65353' };
  return { label: 'Very Unhealthy', color: '#7c4aa0' };
}

function saveLocation(loc) {
  localStorage.setItem(STORAGE_KEYS.location, JSON.stringify(loc));
}

function getSavedLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.location);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getUnits() {
  const saved = localStorage.getItem(STORAGE_KEYS.units);
  if (saved === 'celsius') {
    return { temp: 'celsius', wind: 'kmh', precip: 'mm' };
  }
  return { temp: 'fahrenheit', wind: 'mph', precip: 'inch' };
}

async function searchLocation(query, count = 6) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=${count}&language=en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results?.length) return null;
  return data.results.map((result) => ({
    label: `${result.name}${result.admin1 ? `, ${result.admin1}` : ''}${
      result.country ? `, ${result.country}` : ''
    }`,
    lat: result.latitude,
    lon: result.longitude,
  }));
}

function initLocationControls() {
  const input = document.getElementById('locationInput');
  const searchBtn = document.getElementById('locationSearch');
  const useBtn = document.getElementById('locationUseDevice');
  const suggestions = document.getElementById('locationSuggestions');
  let debounceTimer = null;
  let lastResults = [];

  const saved = getSavedLocation();
  if (saved && input) {
    input.value = saved.label;
  }

  const closeSuggestions = () => {
    if (suggestions) {
      suggestions.innerHTML = '';
      suggestions.classList.add('hidden');
    }
  };

  const renderSuggestions = (items) => {
    if (!suggestions) return;
    lastResults = items || [];
    if (!items?.length) {
      closeSuggestions();
      return;
    }
    suggestions.innerHTML = items
      .map(
        (item) =>
          `<button class="suggestion-item" data-lat="${item.lat}" data-lon="${item.lon}" data-label="${item.label}">${item.label}</button>`
      )
      .join('');
    suggestions.classList.remove('hidden');
    suggestions.querySelectorAll('.suggestion-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lat = Number(btn.dataset.lat);
        const lon = Number(btn.dataset.lon);
        const label = btn.dataset.label;
        saveLocation({ lat, lon, label });
        if (input) input.value = label;
        closeSuggestions();
        fetchWeather();
      });
    });
  };

  if (input) {
    input.addEventListener('input', () => {
      const query = input.value.trim();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (!query || query.length < 2) {
        closeSuggestions();
        return;
      }
      debounceTimer = setTimeout(async () => {
        const results = await searchLocation(query, 6);
        renderSuggestions(results || []);
        if (results && results.length === 1) {
          const single = results[0];
          saveLocation(single);
          if (input) input.value = single.label;
          closeSuggestions();
        fetchWeather({ location: single });
        }
      }, 250);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (lastResults.length) {
        const selected = lastResults[0];
        saveLocation(selected);
        if (input) input.value = selected.label;
        closeSuggestions();
        fetchWeather({ location: selected });
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(closeSuggestions, 200);
    });
  }

  const setSearchingState = (message) => {
    const loading = document.getElementById('weatherLoading');
    const details = document.getElementById('weatherDetails');
    if (loading) {
      loading.textContent = message;
      loading.classList.remove('hidden');
    }
    if (details) details.classList.add('hidden');
  };

  const findBestMatch = (query, results) => {
    if (!results?.length) return null;
    const lower = query.toLowerCase();
    return (
      results.find((item) => item.label.toLowerCase() === lower) ||
      results.find((item) => item.label.toLowerCase().startsWith(lower)) ||
      results[0]
    );
  };

  if (searchBtn && input) {
    searchBtn.addEventListener('click', async () => {
      const query = input.value.trim();
      if (!query) return;
      setSearchingState('Searching location…');

      const cached = findBestMatch(query, lastResults);
      if (cached) {
        closeSuggestions();
        fetchWeather({ location: cached });
        return;
      }

      let results = await searchLocation(query, 1);
      let result = results?.[0];
      if (!result && query.includes(',')) {
        results = await searchLocation(query.split(',')[0].trim(), 1);
        result = results?.[0];
      }
      if (result) {
        closeSuggestions();
        fetchWeather({ location: result });
      } else {
        setSearchingState('No matching location found.');
      }
    });
  }

  if (useBtn) {
    useBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEYS.location);
      closeSuggestions();
      fetchWeather();
    });
  }
}

// ——— Navigation ———
const VALID_PANELS = ['home', 'notes', 'email', 'calendar', 'weather'];

function switchToPanel(target) {
  if (!VALID_PANELS.includes(target)) return;
  const nav = document.getElementById('appNav');
  const panels = document.querySelectorAll('[data-panel]');
  if (!nav) return;
  nav.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.app === target);
  });
  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === target);
  });
}

function getPanelFromHash() {
  const hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
  return VALID_PANELS.includes(hash) ? hash : 'home';
}

function initNav() {
  const nav = document.getElementById('appNav');
  const panels = document.querySelectorAll('[data-panel]');
  if (!nav) return;

  // Restore panel from URL hash on load (so refresh keeps you on the same page)
  switchToPanel(getPanelFromHash());
  document.documentElement.removeAttribute('data-initial-panel');

  nav.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.app;
      switchToPanel(target);
      window.location.hash = target;
    });
  });

  window.addEventListener('hashchange', () => {
    switchToPanel(getPanelFromHash());
  });
}

// ——— Notes ———
function getNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.notes);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setNotes(notes) {
  localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  renderNotes();
}

function addNote(title, body, section) {
  const t = String(title || '').trim() || 'Untitled note';
  const b = String(body || '').trim();
  const sec = String(section || '').trim() || 'General';
  const notes = getNotes();
  notes.unshift({
    id: Date.now(),
    title: t,
    body: b,
    section: sec,
    createdAt: new Date().toISOString(),
  });
  setNotes(notes);
}

function removeNote(id) {
  setNotes(getNotes().filter((note) => note.id !== id));
}

function updateNote(id, title, body, section) {
  const t = String(title || '').trim() || 'Untitled note';
  const b = String(body || '').trim();
  const sec = String(section || '').trim() || 'General';
  const notes = getNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return;
  notes[idx] = { ...notes[idx], title: t, body: b, section: sec };
  setNotes(notes);
}

function renderNotes() {
  const container = document.getElementById('notesBySection');
  if (!container) return;
  const notes = getNotes().map((n) => ({
    ...n,
    section: (n.section && String(n.section).trim()) || 'General',
  }));
  const bySection = {};
  notes.forEach((note) => {
    const sec = note.section;
    if (!bySection[sec]) bySection[sec] = [];
    bySection[sec].push(note);
  });
  const sectionNames = Object.keys(bySection).sort((a, b) => {
    if (a === 'General') return -1;
    if (b === 'General') return 1;
    return a.localeCompare(b);
  });

  container.innerHTML = sectionNames
    .map(
      (sec) => `
      <div class="notes-section-row">
        <h3 class="notes-section-title">${escapeHtml(sec)}</h3>
        <ul class="list">
          ${bySection[sec]
            .map(
              (note) => `
            <li class="list-item note-item" data-id="${note.id}">
              <div class="note-view">
                <h4>${escapeHtml(note.title)}</h4>
                <p>${escapeHtml(note.body || 'No details yet.')}</p>
                <span class="meta">${new Date(note.createdAt).toLocaleString()}</span>
                <div class="note-actions">
                  <button type="button" class="btn-edit" data-id="${note.id}">Edit</button>
                  <button type="button" class="btn-remove" data-id="${note.id}">Delete</button>
                </div>
              </div>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `
    )
    .join('');

  container.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeNote(Number(btn.dataset.id));
    });
  });

  container.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const note = getNotes().find((n) => n.id === id);
      if (!note) return;
      const li = btn.closest('.note-item');
      if (!li) return;
      li.classList.add('editing');
      li.innerHTML = `
        <form class="note-edit-form stack">
          <input type="text" class="note-edit-section" value="${escapeHtml(note.section || 'General')}" placeholder="Section" />
          <input type="text" class="note-edit-title" value="${escapeHtml(note.title)}" placeholder="Title" />
          <textarea class="note-edit-body" rows="4" placeholder="Body">${escapeHtml(note.body || '')}</textarea>
          <div class="note-edit-actions">
            <button type="submit" class="btn">Save</button>
            <button type="button" class="btn-cancel-edit">Cancel</button>
          </div>
        </form>
      `;
      const form = li.querySelector('.note-edit-form');
      const cancelBtn = li.querySelector('.btn-cancel-edit');
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        updateNote(
          id,
          form.querySelector('.note-edit-title').value,
          form.querySelector('.note-edit-body').value,
          form.querySelector('.note-edit-section').value
        );
      });
      cancelBtn.addEventListener('click', () => renderNotes());
    });
  });
}

// ——— Email (Gmail API) ———
function getEmailListEl() {
  return document.getElementById('emailList');
}

let emailPageTokens = [undefined];
let emailCurrentPage = 1;
let emailNextPageToken = null;
let currentEmailList = [];

function showEmailState(loading, connected, showConnectBtn) {
  const loadingEl = document.getElementById('emailLoading');
  const connectBtn = document.getElementById('connectGmailBtn');
  const connectedLabel = document.getElementById('emailConnectedLabel');
  const signOutBtn = document.getElementById('signOutGmailBtn');
  const list = getEmailListEl();
  const paginationEl = document.getElementById('emailPagination');
  if (loadingEl) loadingEl.style.display = loading ? 'block' : 'none';
  if (connectBtn) connectBtn.style.display = showConnectBtn ? 'inline-flex' : 'none';
  if (connectedLabel) connectedLabel.style.display = connected ? 'inline' : 'none';
  if (signOutBtn) signOutBtn.style.display = connected ? 'inline-flex' : 'none';
  if (list) list.style.display = loading ? 'none' : 'block';
  if (paginationEl) paginationEl.style.display = connected && !loading ? 'flex' : 'none';
}

function renderEmailList(emails) {
  const list = getEmailListEl();
  if (!list) return;
  if (!emails || emails.length === 0) {
    list.innerHTML = '<li class="email-empty">No messages in inbox.</li>';
    return;
  }
  currentEmailList = emails;
  list.innerHTML = emails
    .map(
      (email) => `
      <li class="list-item email-list-item" data-email-id="${escapeHtml(String(email.id))}" data-email-subject="${escapeHtml(String(email.subject || ''))}" data-email-sender="${escapeHtml(String(email.sender || ''))}" data-email-time="${escapeHtml(String(email.time || ''))}" role="button" tabindex="0">
        <h4>${escapeHtml(email.subject)}</h4>
        <p>From: ${escapeHtml(email.sender)}</p>
        <span class="meta">${escapeHtml(email.time)}</span>
      </li>
    `
    )
    .join('');
  list.querySelectorAll('.email-list-item').forEach((el) => {
    const id = el.dataset.emailId;
    const listEmail = {
      id,
      subject: el.dataset.emailSubject || '',
      sender: el.dataset.emailSender || '',
      time: el.dataset.emailTime || '',
    };
    el.addEventListener('click', () => openEmailView(id, listEmail));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEmailView(id, listEmail); } });
  });
}

let emailViewOpen = false;

function showInboxList() {
  const list = getEmailListEl();
  const view = document.getElementById('emailView');
  if (list) list.style.display = 'block';
  if (view) view.style.display = 'none';
  emailViewOpen = false;
}

function showEmailView() {
  const list = getEmailListEl();
  const view = document.getElementById('emailView');
  if (list) list.style.display = 'none';
  if (view) view.style.display = 'block';
  emailViewOpen = true;
}

function escapeForSrcdoc(html) {
  return html
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function openEmailView(id, listEmailFromClick) {
  if (!id) return;
  const subjectEl = document.getElementById('emailViewSubject');
  const fromEl = document.getElementById('emailViewFrom');
  const dateEl = document.getElementById('emailViewDate');
  const bodyPlainEl = document.getElementById('emailViewBodyPlain');
  const bodyHtmlEl = document.getElementById('emailViewBodyHtml');
  showEmailView();

  const listEmail = listEmailFromClick || currentEmailList.find((e) => String(e.id) === String(id));
  const subjectFromList = (listEmail && listEmail.subject) ? String(listEmail.subject) : '';
  const fromFromList = (listEmail && listEmail.sender) ? String(listEmail.sender) : '';
  const timeFromList = (listEmail && listEmail.time) ? String(listEmail.time) : '';

  if (subjectEl) subjectEl.textContent = subjectFromList || 'Loading…';
  if (fromEl) fromEl.textContent = fromFromList ? `From: ${fromFromList}` : (subjectFromList ? 'From: —' : '');
  if (dateEl) dateEl.textContent = timeFromList;
  if (bodyPlainEl) { bodyPlainEl.style.display = 'none'; bodyPlainEl.textContent = ''; }
  if (bodyHtmlEl) { bodyHtmlEl.style.display = 'none'; bodyHtmlEl.srcdoc = ''; }

  fetch(`${API_BASE}/api/gmail/message/${encodeURIComponent(id)}`, { credentials: 'include' })
    .then((res) => res.json().catch(() => ({})))
    .then((data) => {
      if (data.error) {
        if (subjectEl && !subjectFromList) subjectEl.textContent = 'Could not load message';
        if (fromEl && !fromFromList) fromEl.textContent = data.message || data.error;
        if (bodyPlainEl) {
          bodyPlainEl.style.display = 'block';
          bodyPlainEl.textContent = (data.message || data.error) + ' — showing inbox preview only.';
        }
        return;
      }
      if (subjectEl) subjectEl.textContent = data.subject || subjectFromList || '(No subject)';
      if (fromEl) fromEl.textContent = `From: ${data.from || fromFromList || ''}`;
      if (dateEl) dateEl.textContent = data.date || timeFromList || '';
      const hasHtml = data.bodyHtml && data.bodyHtml.trim().length > 0;
      const hasPlain = data.bodyPlain && data.bodyPlain.trim().length > 0;
      const hasSnippet = data.snippet && data.snippet.trim().length > 0;
      if (hasHtml) {
        bodyPlainEl.style.display = 'none';
        bodyHtmlEl.style.display = 'block';
        bodyHtmlEl.srcdoc = escapeForSrcdoc(data.bodyHtml);
      } else if (hasPlain) {
        bodyPlainEl.style.display = 'block';
        bodyHtmlEl.style.display = 'none';
        bodyPlainEl.textContent = data.bodyPlain;
      } else if (hasSnippet) {
        bodyPlainEl.style.display = 'block';
        bodyHtmlEl.style.display = 'none';
        bodyPlainEl.textContent = data.snippet;
      } else {
        bodyPlainEl.style.display = 'block';
        bodyHtmlEl.style.display = 'none';
        bodyPlainEl.textContent = '(No content)';
      }
    })
    .catch(() => {
      if (subjectEl && !subjectFromList) subjectEl.textContent = 'Could not load message';
      if (fromEl && !fromFromList) fromEl.textContent = 'Check your connection and try again.';
      if (bodyPlainEl && bodyPlainEl.style.display !== 'block') {
        bodyPlainEl.style.display = 'block';
        bodyPlainEl.textContent = 'Could not load body. You are seeing inbox preview only.';
      }
    });
}

function initEmailViewBack() {
  const backBtn = document.getElementById('emailViewBack');
  if (backBtn) backBtn.onclick = showInboxList;
}

function updateEmailPaginationUI() {
  const prevBtn = document.getElementById('emailPagePrev');
  const nextBtn = document.getElementById('emailPageNext');
  const labelEl = document.getElementById('emailPageLabel');
  if (prevBtn) prevBtn.disabled = emailCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = !emailNextPageToken;
  if (labelEl) {
    labelEl.textContent = `Page ${emailCurrentPage}`;
    labelEl.title = emailCurrentPage === 1 ? 'Page 1' : 'Go to page 1';
  }
}

async function fetchEmails(pageToken) {
  const list = getEmailListEl();
  showEmailState(true, false, false);

  const url = pageToken
    ? `${API_BASE}/api/gmail/inbox?pageToken=${encodeURIComponent(pageToken)}`
    : `${API_BASE}/api/gmail/inbox`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || (data && data.code === 'NOT_CONNECTED')) {
      showEmailState(false, false, true);
      renderEmailList([]);
      if (list) list.innerHTML = '<li class="email-empty">Connect Gmail to see your inbox.</li>';
      emailPageTokens = [undefined];
      emailCurrentPage = 1;
      emailNextPageToken = null;
      return;
    }

    if (!res.ok) {
      showEmailState(false, false, true);
      if (list) list.innerHTML = '<li class="email-empty">Could not load inbox. Try connecting again.</li>';
      return;
    }

    emailNextPageToken = data.nextPageToken || null;
    if (pageToken) {
      if (emailNextPageToken) {
        while (emailPageTokens.length <= emailCurrentPage) emailPageTokens.push(null);
        emailPageTokens[emailCurrentPage] = emailNextPageToken;
      }
    } else {
      emailCurrentPage = 1;
      emailPageTokens[0] = undefined;
      if (emailNextPageToken) emailPageTokens[1] = emailNextPageToken;
    }

    showEmailState(false, true, false);
    renderEmailList(data.emails || []);
    updateEmailPaginationUI();
  } catch (_) {
    showEmailState(false, false, true);
    if (list) list.innerHTML = '<li class="email-empty">Cannot reach server. Deploy with API or run locally with <code>vercel dev</code>.</li>';
  }
}

function goToEmailPage(direction) {
  if (direction === 'next') {
    if (!emailNextPageToken) return;
    const tokenForNextPage = emailPageTokens[emailCurrentPage];
    if (!tokenForNextPage) return;
    emailCurrentPage += 1;
    fetchEmails(tokenForNextPage);
  } else {
    if (emailCurrentPage <= 1) return;
    emailCurrentPage -= 1;
    const pageToken = emailCurrentPage === 1 ? undefined : emailPageTokens[emailCurrentPage - 1];
    fetchEmails(pageToken);
  }
}

function initEmailPagination() {
  const panel = document.getElementById('panel-email');
  if (!panel) return;
  panel.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    if (target.id === 'emailPagePrev') {
      e.preventDefault();
      goToEmailPage('prev');
    } else if (target.id === 'emailPageNext') {
      e.preventDefault();
      goToEmailPage('next');
    } else if (target.id === 'emailPageLabel' && emailCurrentPage > 1) {
      e.preventDefault();
      emailCurrentPage = 1;
      fetchEmails(undefined);
    }
  });
}

function signOutGmail() {
  const signOutBtn = document.getElementById('signOutGmailBtn');
  const list = getEmailListEl();
  if (signOutBtn) {
    signOutBtn.disabled = true;
    signOutBtn.textContent = 'Signing out…';
  }
  fetch(`${API_BASE}/api/auth/gmail/signout`, { method: 'GET', credentials: 'include' })
    .then(() => {
      showEmailState(false, false, true);
      if (list) list.innerHTML = '<li class="email-empty">Connect Gmail to see your inbox.</li>';
    })
    .catch(() => {
      showEmailState(false, false, true);
      if (list) list.innerHTML = '<li class="email-empty">Connect Gmail to see your inbox.</li>';
    })
    .finally(() => {
      if (signOutBtn) {
        signOutBtn.disabled = false;
        signOutBtn.textContent = 'Sign out';
      }
    });
}

function renderEmails() {
  showInboxList();
  fetchEmails();
  const signOutBtn = document.getElementById('signOutGmailBtn');
  if (signOutBtn) signOutBtn.onclick = signOutGmail;
  initEmailViewBack();
  initEmailPagination();
}

// ——— Calendar ———
let calendarViewDate = new Date();
let selectedCalendarDate = '';

function getEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.events);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getEventsForDate(dateStr) {
  return getEvents().filter((e) => e.date === dateStr);
}

function setEvents(events) {
  localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events));
  renderCalendar();
  renderEvents();
}

function addEvent(title, date, time) {
  const t = String(title || '').trim() || 'New event';
  if (!date) return;
  const events = getEvents();
  events.push({
    id: Date.now(),
    title: t,
    date,
    time: time || '',
  });
  setEvents(events);
}

function removeEvent(id) {
  setEvents(getEvents().filter((event) => event.id !== id));
}

function toDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getSelectedDateStr() {
  if (selectedCalendarDate) return selectedCalendarDate;
  selectedCalendarDate = toDateStr(new Date());
  return selectedCalendarDate;
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const monthYearEl = document.getElementById('calendarMonthYear');
  if (!grid || !monthYearEl) return;

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  const todayStr = toDateStr(new Date());

  monthYearEl.textContent = calendarViewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const daysInMonth = last.getDate();

  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
  const leadingEmpty = startDay;
  const prevMonthLast = new Date(year, month, 0);
  const daysInPrevMonth = prevMonthLast.getDate();

  grid.innerHTML = '';

  for (let i = 0; i < leadingEmpty; i++) {
    const day = daysInPrevMonth - leadingEmpty + 1 + i;
    const cell = document.createElement('div');
    cell.className = 'calendar-day calendar-day-other';
    cell.innerHTML = `<span class="calendar-day-num">${day}</span>`;
    grid.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    const eventsOnDay = getEventsForDate(dateStr);
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === getSelectedDateStr();

    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    if (isToday) cell.classList.add('calendar-day-today');
    if (isSelected) cell.classList.add('calendar-day-selected');
    if (eventsOnDay.length > 0) cell.classList.add('calendar-day-has-events');
    cell.dataset.date = dateStr;
    cell.innerHTML = `
      <span class="calendar-day-num">${day}</span>
      ${eventsOnDay.length > 0 ? `<span class="calendar-day-dot" title="${eventsOnDay.length} event(s)"></span>` : ''}
    `;
    cell.addEventListener('click', () => {
      selectedCalendarDate = dateStr;
      const dateInput = document.getElementById('eventDate');
      if (dateInput) dateInput.value = dateStr;
      renderCalendar();
      renderEvents();
    });
    grid.appendChild(cell);
  }

  const filled = leadingEmpty + daysInMonth;
  const trailing = totalCells - filled;
  for (let i = 0; i < trailing; i++) {
    const day = i + 1;
    const cell = document.createElement('div');
    cell.className = 'calendar-day calendar-day-other';
    cell.innerHTML = `<span class="calendar-day-num">${day}</span>`;
    grid.appendChild(cell);
  }
}

function getThisWeekDateStrs() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(toDateStr(d));
  }
  return out;
}

function renderEvents() {
  const list = document.getElementById('eventList');
  const heading = document.getElementById('eventListHeading');
  if (!list) return;

  const dateStr = getSelectedDateStr();
  const todayStr = toDateStr(new Date());
  const dayEvents = getEvents()
    .filter((e) => e.date === dateStr)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  if (heading) {
    heading.textContent = dateStr === todayStr ? 'Events Today' : `Events for ${new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  }

  if (dayEvents.length === 0) {
    list.innerHTML = '<li class="calendar-upcoming-empty">No events for this day.</li>';
  } else {
    list.innerHTML = dayEvents
      .map(
        (ev) => `
        <li class="list-item list-item-compact">
          <span class="event-title">${escapeHtml(ev.title)}</span>
          <span class="meta">${ev.time ? escapeHtml(ev.time) : 'All day'}</span>
          <button class="btn-remove" data-id="${ev.id}">Remove</button>
        </li>
      `
      )
      .join('');
    list.querySelectorAll('.btn-remove').forEach((btn) => {
      btn.addEventListener('click', () => removeEvent(Number(btn.dataset.id)));
    });
  }
}

function formatEventDate(dateStr, timeStr) {
  const date = new Date(`${dateStr}T${timeStr || '00:00'}`);
  const dateText = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (timeStr) {
    return `${dateText} · ${timeStr}`;
  }
  return dateText;
}

function parseLocalTimeToUtcMillis(localTime, offsetSeconds) {
  if (!localTime || typeof offsetSeconds !== 'number') {
    return new Date(localTime).getTime();
  }
  const [datePart, timePart] = localTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - offsetSeconds * 1000;
  return utcMillis;
}

function formatHourLabel(utcMillis, timeZone) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      timeZone: timeZone || undefined,
    }).format(new Date(utcMillis));
  } catch {
    return new Date(utcMillis).toLocaleTimeString([], { hour: 'numeric' });
  }
}

function formatTimeInZone(localTimeString, timeZone, offsetSeconds) {
  const utcMillis = parseLocalTimeToUtcMillis(localTimeString, offsetSeconds);
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timeZone || undefined,
    }).format(new Date(utcMillis));
  } catch {
    return new Date(utcMillis).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

function getZoneHourStartUtc(nowUtcMillis, offsetSeconds) {
  if (typeof offsetSeconds !== 'number') {
    const now = new Date(nowUtcMillis);
    now.setMinutes(0, 0, 0);
    return now.getTime();
  }
  const zoneNow = new Date(nowUtcMillis + offsetSeconds * 1000);
  const year = zoneNow.getUTCFullYear();
  const month = zoneNow.getUTCMonth();
  const day = zoneNow.getUTCDate();
  const hour = zoneNow.getUTCHours();
  return Date.UTC(year, month, day, hour) - offsetSeconds * 1000;
}
// ——— AI Assistant ———
function addAiMessage(text, type = 'assistant') {
  const list = document.getElementById('aiMessages');
  if (!list) return;
  const item = document.createElement('div');
  item.className = `ai-message ${type}`;
  item.textContent = text;
  list.appendChild(item);
  list.scrollTop = list.scrollHeight;
}

function parseDateFromText(text) {
  const months = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };
  const monthMatch = text.match(
    /(\d{1,2})(st|nd|rd|th)?\s*(of)?\s*(january|february|march|april|may|june|july|august|september|october|november|december)/i
  );
  if (monthMatch) {
    const day = Number(monthMatch[1]);
    const month = months[monthMatch[4].toLowerCase()];
    const year = new Date().getFullYear();
    let date = new Date(year, month, day);
    if (date < new Date()) {
      date = new Date(year + 1, month, day);
    }
    return date.toISOString().slice(0, 10);
  }

  const numericMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (numericMatch) {
    const month = Number(numericMatch[1]) - 1;
    const day = Number(numericMatch[2]);
    const year = new Date().getFullYear();
    let date = new Date(year, month, day);
    if (date < new Date()) {
      date = new Date(year + 1, month, day);
    }
    return date.toISOString().slice(0, 10);
  }
  return null;
}

function parseTimeFromText(text) {
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return '';
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const period = match[3]?.toLowerCase();
  if (period === 'pm' && hour < 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function handleAiCommand(text) {
  const lower = text.toLowerCase();
  if (lower.includes('add note') || lower.startsWith('note ')) {
    const noteText = text.replace(/add note/i, '').trim() || text;
    addNote('AI Note', noteText, 'General');
    addAiMessage('Added a new note for you.');
    return;
  }

  if (lower.includes('calendar') || lower.includes('schedule') || lower.includes('meeting')) {
    const date = parseDateFromText(lower);
    const time = parseTimeFromText(lower);
    if (!date) {
      addAiMessage('Tell me the date, like “Feb 7” or “02/07”.');
      return;
    }
    addEvent(text, date, time);
    addAiMessage(`Got it. Added to your calendar on ${date}${time ? ` at ${time}` : ''}.`);
    return;
  }

  addAiMessage(
    'I can add notes or calendar events. Try: “Add note idea for project” or “Schedule meeting on Feb 7 at 3pm”.'
  );
}

const AI_DOCK_COLLAPSED_KEY = 'hub_ai_dock_collapsed';

function initAiDockToggle() {
  const dock = document.getElementById('aiDock');
  const tab = document.getElementById('aiDockTab');
  const collapseBtn = document.getElementById('aiDockCollapse');
  if (!dock) return;

  function setCollapsed(collapsed) {
    dock.classList.toggle('collapsed', collapsed);
    try {
      localStorage.setItem(AI_DOCK_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch (_) {}
  }

  const saved = localStorage.getItem(AI_DOCK_COLLAPSED_KEY);
  if (saved === '1') setCollapsed(true);

  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => setCollapsed(true));
  }
  if (tab) {
    tab.addEventListener('click', () => setCollapsed(false));
  }
}

function initAiAssistant() {
  const form = document.getElementById('aiForm');
  const input = document.getElementById('aiInput');
  const mic = document.getElementById('aiMic');

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addAiMessage(text, 'user');
      handleAiCommand(text);
      input.value = '';
    });
  }

  if (mic && 'webkitSpeechRecognition' in window) {
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    mic.addEventListener('click', () => {
      recognition.start();
    });
    recognition.addEventListener('result', (event) => {
      const transcript = event.results[0][0].transcript;
      if (input) input.value = transcript;
      addAiMessage(transcript, 'user');
      handleAiCommand(transcript);
      if (input) input.value = '';
    });
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ——— Forms ———
function initForms() {
  const noteForm = document.getElementById('noteForm');
  const noteTitle = document.getElementById('noteTitle');
  const noteBody = document.getElementById('noteBody');
  const eventForm = document.getElementById('eventForm');
  const eventTitle = document.getElementById('eventTitle');
  const eventDate = document.getElementById('eventDate');
  const eventTime = document.getElementById('eventTime');
  const noteSection = document.getElementById('noteSection');

  if (noteForm) {
    noteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addNote(noteTitle.value, noteBody.value, noteSection ? noteSection.value : '');
      noteTitle.value = '';
      noteBody.value = '';
      if (noteSection) noteSection.value = '';
    });
  }

  if (eventForm) {
    eventForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const date = eventDate.value;
      if (!date) return;
      addEvent(eventTitle.value, date, eventTime.value);
      eventTitle.value = '';
      eventTime.value = '';
      eventDate.value = date;
    });
  }
}

// ——— Init ———
function init() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  initNav();
  initLocationControls();
  fetchWeather();
  scheduleHourlyWeatherRefresh();
  renderNotes();
  renderEmails();
  const gmailParam = new URLSearchParams(window.location.search).get('gmail');
  if (gmailParam === 'connected') {
    fetchEmails();
    const url = window.location.pathname + (window.location.hash || '');
    window.history.replaceState({}, '', url);
  }
  if (!selectedCalendarDate) selectedCalendarDate = toDateStr(new Date());
  const eventDateInput = document.getElementById('eventDate');
  if (eventDateInput && !eventDateInput.value) eventDateInput.value = selectedCalendarDate;
  renderCalendar();
  renderEvents();
  renderQuoteOfTheDay();
  initCalendarNav();
  initForms();
  initAiDockToggle();
  initAiAssistant();
  addAiMessage('Hi! I can add notes or calendar events for you.');
}

init();

function scheduleHourlyWeatherRefresh() {
  const now = new Date();
  const zone = window.__hubWeatherTimezone;
  const offsetSeconds = zone?.offsetSeconds;
  let delay = 60 * 60 * 1000;
  if (typeof offsetSeconds === 'number') {
    const nowUtc = Date.now();
    const zoneHourStart = getZoneHourStartUtc(nowUtc, offsetSeconds);
    delay = zoneHourStart + 60 * 60 * 1000 - nowUtc;
  } else {
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    delay = nextHour - now;
  }
  setTimeout(() => {
    fetchWeather();
    setInterval(fetchWeather, 60 * 60 * 1000);
  }, delay);
}
