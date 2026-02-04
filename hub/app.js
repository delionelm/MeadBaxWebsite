/* Daily Hub — App logic */

const STORAGE_KEYS = {
  todos: 'hub_todos',
  goals: 'hub_goals',
  openaiKey: 'hub_openai_key',
};

// ——— Date & time ———
function formatDate(d) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return d.toLocaleDateString(undefined, options);
}

function formatTime(d) {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getDayMeta(d) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(d.getFullYear(), 11, 31);
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

  const defaultLat = 40.7128;
  const defaultLon = -74.006;

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
      if (tempEl) tempEl.textContent = `${temp}°${cur.temperature_2m === temp ? 'C' : ''}`;
      if (descEl) descEl.textContent = desc;
      if (metaEl) metaEl.textContent = meta;

      window.__hubWeather = { temp, desc, code: cur.weather_code, humidity: cur.relative_humidity_2m, wind: cur.wind_speed_10m };
    } catch (e) {
      if (loading) loading.textContent = 'Weather unavailable';
      if (loading) loading.classList.remove('hidden');
      if (details) details.classList.add('hidden');
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
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Rain showers',
    82: 'Heavy rain showers',
    85: 'Snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with heavy hail',
  };
  return map[code] || 'Unknown';
}

// ——— Todos ———
function getTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.todos);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setTodos(todos) {
  localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(todos));
  renderTodos();
  refreshAiSuggestion();
}

function addTodo(text) {
  const t = String(text).trim();
  if (!t) return;
  const todos = getTodos();
  todos.push({ id: Date.now(), text: t, done: false });
  setTodos(todos);
}

function toggleTodo(id) {
  const todos = getTodos().map((item) =>
    item.id === id ? { ...item, done: !item.done } : item
  );
  setTodos(todos);
}

function removeTodo(id) {
  setTodos(getTodos().filter((item) => item.id !== id));
}

function renderTodos() {
  const list = document.getElementById('todoList');
  if (!list) return;
  const todos = getTodos();
  list.innerHTML = todos
    .map(
      (item) => `
    <li class="todo-item ${item.done ? 'done' : ''}" data-id="${item.id}">
      <input type="checkbox" ${item.done ? 'checked' : ''} aria-label="Complete task" />
      <span class="todo-label">${escapeHtml(item.text)}</span>
      <button type="button" class="btn-remove" aria-label="Remove task">Remove</button>
    </li>
  `
    )
    .join('');

  list.querySelectorAll('.todo-item').forEach((el) => {
    const id = Number(el.dataset.id);
    el.querySelector('input[type="checkbox"]').addEventListener('change', () => toggleTodo(id));
    el.querySelector('.btn-remove').addEventListener('click', () => removeTodo(id));
  });
}

// ——— Goals ———
function getGoals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.goals);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setGoals(goals) {
  localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(goals));
  renderGoals();
  refreshAiSuggestion();
}

function addGoal(text) {
  const t = String(text).trim();
  if (!t) return;
  const goals = getGoals();
  goals.push({ id: Date.now(), text: t, done: false });
  setGoals(goals);
}

function toggleGoal(id) {
  const goals = getGoals().map((item) =>
    item.id === id ? { ...item, done: !item.done } : item
  );
  setGoals(goals);
}

function removeGoal(id) {
  setGoals(getGoals().filter((item) => item.id !== id));
}

function renderGoals() {
  const list = document.getElementById('goalList');
  if (!list) return;
  const goals = getGoals();
  list.innerHTML = goals
    .map(
      (item) => `
    <li class="goal-item ${item.done ? 'done' : ''}" data-id="${item.id}">
      <input type="checkbox" ${item.done ? 'checked' : ''} aria-label="Complete goal" />
      <span class="goal-label">${escapeHtml(item.text)}</span>
      <button type="button" class="btn-remove" aria-label="Remove goal">Remove</button>
    </li>
  `
    )
    .join('');

  list.querySelectorAll('.goal-item').forEach((el) => {
    const id = Number(el.dataset.id);
    el.querySelector('input[type="checkbox"]').addEventListener('change', () => toggleGoal(id));
    el.querySelector('.btn-remove').addEventListener('click', () => removeGoal(id));
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ——— AI suggestion ———
function getOpenAIKey() {
  return localStorage.getItem(STORAGE_KEYS.openaiKey) || '';
}

function buildContext() {
  const now = new Date();
  const todos = getTodos().filter((t) => !t.done);
  const goals = getGoals().filter((g) => !g.done);
  const weather = window.__hubWeather;
  return {
    date: formatDate(now),
    time: formatTime(now),
    weekday: now.toLocaleDateString(undefined, { weekday: 'long' }),
    tasks: todos.map((t) => t.text),
    goals: goals.map((g) => g.text),
    weather: weather
      ? `${weather.desc}, ${weather.temp}°C, humidity ${weather.humidity}%, wind ${weather.wind} km/h`
      : 'Unknown',
  };
}

function buildPrompt(ctx) {
  return `You are a concise daily planning assistant. Given the following, suggest what the user should do today in 2–4 short, actionable sentences. Be specific and consider weather and time of day.

Today: ${ctx.date} (${ctx.weekday}), current time: ${ctx.time}
Weather: ${ctx.weather}
Current tasks: ${ctx.tasks.length ? ctx.tasks.join('; ') : 'None'}
Current goals: ${ctx.goals.length ? ctx.goals.join('; ') : 'None'}

Reply with only the suggestion, no preamble.`;
}

function localSuggestion(ctx) {
  const parts = [];
  const tasks = ctx.tasks;
  const goals = ctx.goals;
  const weather = (ctx.weather || '').toLowerCase();
  const isWeekend = ['Saturday', 'Sunday'].includes(ctx.weekday);
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  if (tasks.length) {
    parts.push(`Focus on "${tasks[0]}" first this ${timeOfDay}.`);
    if (tasks.length > 1) {
      parts.push(`You have ${tasks.length} tasks today; ticking off the first will build momentum.`);
    }
  } else if (goals.length) {
    parts.push(`You have no tasks yet. Consider breaking "${goals[0]}" into a small step you can do today.`);
  } else {
    parts.push(`No tasks or goals yet. Add one or two to get a tailored suggestion.`);
  }

  if (weather.includes('rain') || weather.includes('snow') || weather.includes('storm')) {
    parts.push('With this weather, indoor or low-mobility tasks are a good fit.');
  } else if (weather.includes('clear') || weather.includes('partly')) {
    parts.push('Good day to include something outdoors if it fits your list.');
  }

  if (isWeekend && (tasks.length || goals.length)) {
    parts.push('Use the weekend to make progress without rushing.');
  }

  return parts.join(' ');
}

async function fetchAiSuggestion() {
  const loading = document.getElementById('aiLoading');
  const suggestion = document.getElementById('aiSuggestion');
  if (loading) loading.classList.remove('hidden');
  if (suggestion) suggestion.classList.add('hidden');

  const ctx = buildContext();
  const key = getOpenAIKey();

  if (key && key.startsWith('sk-')) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: buildPrompt(ctx) }],
          max_tokens: 200,
        }),
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) {
        if (loading) loading.classList.add('hidden');
        if (suggestion) {
          suggestion.textContent = text;
          suggestion.classList.remove('hidden');
        }
        return;
      }
    } catch (e) {
      console.warn('OpenAI request failed, using local suggestion:', e);
    }
  }

  const local = localSuggestion(ctx);
  if (loading) loading.classList.add('hidden');
  if (suggestion) {
    suggestion.textContent = local;
    suggestion.classList.remove('hidden');
  }
}

function refreshAiSuggestion() {
  fetchAiSuggestion();
}

// ——— Settings ———
function initSettings() {
  const panel = document.getElementById('settingsPanel');
  const btn = document.getElementById('btnSettings');
  const input = document.getElementById('openaiKey');
  const save = document.getElementById('saveSettings');

  if (input) input.value = getOpenAIKey() || '';

  if (btn && panel) {
    btn.addEventListener('click', () => {
      panel.classList.toggle('hidden');
    });
  }
  if (save && input) {
    save.addEventListener('click', () => {
      const val = input.value.trim();
      if (val) localStorage.setItem(STORAGE_KEYS.openaiKey, val);
      else localStorage.removeItem(STORAGE_KEYS.openaiKey);
      refreshAiSuggestion();
    });
  }
}

// ——— Forms ———
function initForms() {
  const todoForm = document.getElementById('todoForm');
  const todoInput = document.getElementById('todoInput');
  const goalForm = document.getElementById('goalForm');
  const goalInput = document.getElementById('goalInput');
  const refreshBtn = document.getElementById('refreshAi');

  if (todoForm && todoInput) {
    todoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addTodo(todoInput.value);
      todoInput.value = '';
    });
  }
  if (goalForm && goalInput) {
    goalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addGoal(goalInput.value);
      goalInput.value = '';
    });
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshAiSuggestion);
  }
}

// ——— Init ———
function init() {
  updateDateTime();
  setInterval(updateDateTime, 1000);

  fetchWeather();
  renderTodos();
  renderGoals();
  initSettings();
  initForms();

  // Delay AI slightly so weather may be ready
  setTimeout(refreshAiSuggestion, 1500);
}

init();
