/* MeadBax Hub — App logic */

const STORAGE_KEYS = {
  notes: 'hub_notes',
  events: 'hub_events',
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
async function fetchWeather() {
  const loading = document.getElementById('weatherLoading');
  const details = document.getElementById('weatherDetails');
  const tempEl = document.getElementById('weatherTemp');
  const descEl = document.getElementById('weatherDesc');
  const metaEl = document.getElementById('weatherMeta');
  const extraEl = document.getElementById('weatherExtra');

  const defaultLat = 38.8048;
  const defaultLon = -77.0469;

  function success(pos) {
    fetchWithCoords(pos.coords.latitude, pos.coords.longitude);
  }

  function error() {
    fetchWithCoords(defaultLat, defaultLon);
  }

  async function fetchWithCoords(lat, lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.reason || 'Weather fetch failed');

      const cur = data.current;
      const temp = Math.round(cur.temperature_2m);
      const desc = weatherCodeToDesc(cur.weather_code);
      const meta = `Humidity ${cur.relative_humidity_2m}% · Wind ${cur.wind_speed_10m} km/h`;

      if (loading) loading.classList.add('hidden');
      if (details) details.classList.remove('hidden');
      if (tempEl) tempEl.textContent = `${temp}°C`;
      if (descEl) descEl.textContent = desc;
      if (metaEl) metaEl.textContent = meta;
      if (extraEl) {
        extraEl.textContent = `Last updated ${new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`;
      }

      window.__hubWeather = { temp, desc, code: cur.weather_code };
    } catch (e) {
      if (loading) loading.textContent = 'Weather unavailable';
      if (loading) loading.classList.remove('hidden');
      if (details) details.classList.add('hidden');
      if (extraEl) extraEl.textContent = '';
      window.__hubWeather = null;
    }
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
function getEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.events);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setEvents(events) {
  localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events));
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

function renderEvents() {
  const list = document.getElementById('eventList');
  if (!list) return;
  const events = getEvents()
    .slice()
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  list.innerHTML = events
    .map(
      (event) => `
      <li class="list-item">
        <h4>${escapeHtml(event.title)}</h4>
        <span class="meta">${formatEventDate(event.date, event.time)}</span>
        <button class="btn-remove" data-id="${event.id}">Remove</button>
      </li>
    `
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
  fetchWeather();
  renderNotes();
  renderEmails();
  renderEvents();
  initForms();
  initAiDockToggle();
  initAiAssistant();
  addAiMessage('Hi! I can add notes or calendar events for you.');
}

init();
