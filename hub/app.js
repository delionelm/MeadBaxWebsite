/* MeadBax Hub — App logic */

const STORAGE_KEYS = {
  notes: 'hub_notes',
  events: 'hub_events',
  location: 'hub_location',
  units: 'hub_units',
};

const EMAIL_SAMPLE = [
  { subject: 'Welcome to MeadBax Hub', sender: 'Support Team', time: 'Just now' },
  { subject: 'Weekly summary ready', sender: 'Calendar Bot', time: 'Today, 8:12 AM' },
  { subject: 'Reminder: Update your notes', sender: 'Notes Assistant', time: 'Yesterday' },
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
          fetchWeather({ useSavedOnly: true });
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
        fetchWeather({ useSavedOnly: true });
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(closeSuggestions, 200);
    });
  }

  if (searchBtn && input) {
    searchBtn.addEventListener('click', async () => {
      const query = input.value.trim();
      if (!query) return;
      const results = await searchLocation(query, 1);
      const result = results?.[0];
      if (result) {
        saveLocation(result);
        closeSuggestions();
        fetchWeather({ useSavedOnly: true });
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
function initNav() {
  const nav = document.getElementById('appNav');
  const panels = document.querySelectorAll('[data-panel]');
  if (!nav) return;

  nav.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      nav.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.app;
      panels.forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.panel === target);
      });
    });
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

// ——— Email ———
function renderEmails() {
  const list = document.getElementById('emailList');
  if (!list) return;
  list.innerHTML = EMAIL_SAMPLE.map(
    (email) => `
      <li class="list-item">
        <h4>${escapeHtml(email.subject)}</h4>
        <p>From: ${escapeHtml(email.sender)}</p>
        <span class="meta">${escapeHtml(email.time)}</span>
      </li>
    `
  ).join('');
}

// ——— Calendar ———
let calendarViewDate = new Date();

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

  grid.innerHTML = '';

  for (let i = 0; i < leadingEmpty; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day calendar-day-other';
    cell.textContent = '';
    grid.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    const eventsOnDay = getEventsForDate(dateStr);
    const isToday = dateStr === todayStr;

    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    if (isToday) cell.classList.add('calendar-day-today');
    if (eventsOnDay.length > 0) cell.classList.add('calendar-day-has-events');
    cell.dataset.date = dateStr;
    cell.innerHTML = `
      <span class="calendar-day-num">${day}</span>
      ${eventsOnDay.length > 0 ? `<span class="calendar-day-dot" title="${eventsOnDay.length} event(s)">${eventsOnDay.length}</span>` : ''}
    `;
    cell.addEventListener('click', () => {
      const dateInput = document.getElementById('eventDate');
      if (dateInput) dateInput.value = dateStr;
    });
    grid.appendChild(cell);
  }

  const filled = leadingEmpty + daysInMonth;
  const trailing = totalCells - filled;
  for (let i = 0; i < trailing; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day calendar-day-other';
    cell.textContent = '';
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
  if (!list) return;

  const weekDays = getThisWeekDateStrs();
  const todayStr = toDateStr(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toDateStr(tomorrow);

  const events = getEvents()
    .filter((e) => weekDays.includes(e.date))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const dayLabels = {};
  weekDays.forEach((dateStr) => {
    if (dateStr === todayStr) dayLabels[dateStr] = 'Today';
    else if (dateStr === tomorrowStr) dayLabels[dateStr] = 'Tomorrow';
    else {
      const d = new Date(dateStr);
      dayLabels[dateStr] = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
  });

  const byDay = {};
  weekDays.forEach((dateStr) => (byDay[dateStr] = []));
  events.forEach((e) => byDay[e.date].push(e));

  list.innerHTML = weekDays
    .filter((dateStr) => byDay[dateStr].length > 0)
    .map(
      (dateStr) => {
        const dayEvents = byDay[dateStr];
        const label = dayLabels[dateStr];
        return `
          <li class="calendar-upcoming-day">
            <span class="calendar-upcoming-label">${escapeHtml(label)}</span>
            <ul class="list list-compact">
              ${dayEvents
                .map(
                  (ev) => `
                <li class="list-item list-item-compact">
                  <span class="event-title">${escapeHtml(ev.title)}</span>
                  <span class="meta">${ev.time ? escapeHtml(ev.time) : 'All day'}</span>
                  <button class="btn-remove" data-id="${ev.id}">Remove</button>
                </li>
              `
                )
                .join('')}
            </ul>
          </li>
        `;
      }
    )
    .join('');

  list.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', () => removeEvent(Number(btn.dataset.id)));
  });
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

<<<<<<< HEAD
function initCalendarNav() {
  const prev = document.getElementById('calendarPrev');
  const next = document.getElementById('calendarNext');
  if (prev) {
    prev.addEventListener('click', () => {
      calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1);
      renderCalendar();
    });
  }
  if (next) {
    next.addEventListener('click', () => {
      calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1);
      renderCalendar();
    });
  }
}

=======
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

>>>>>>> b97d198 (Build full weather dashboard with location search.)
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
      if (!eventDate.value) return;
      addEvent(eventTitle.value, eventDate.value, eventTime.value);
      eventTitle.value = '';
      eventDate.value = '';
      eventTime.value = '';
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
  renderCalendar();
  renderEvents();
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
