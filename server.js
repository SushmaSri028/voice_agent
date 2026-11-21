import http from 'node:http'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { authUrl, finishSignIn, gmailConfigured, gmailConnected, listEmails, readEmail } from './gmail.js'

const FILE = './agenda.json'
const MODEL = 'openai/gpt-oss-120b'

// Only these can be opened. Add your own!
const WEBSITES = {
  gmail: 'https://mail.google.com',
  calendar: 'https://calendar.google.com',
  youtube: 'https://www.youtube.com',
  linkedin: 'https://www.linkedin.com',
  github: 'https://github.com/SushmaSri028',
  groq: 'https://console.groq.com',
}

const APPS = {
  vscode: 'Visual Studio Code',
  notes: 'Notes',
  calculator: 'Calculator',
  chrome: 'Google Chrome',
}
const HOME_CITY = 'Boca Raton';
let lastWeather = null;

const WEATHER_CODES = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'cloudy',
  45: 'foggy', 48: 'foggy', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 80: 'rain showers',
  81: 'rain showers', 82: 'heavy showers', 95: 'thunderstorm',
  96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};

async function getWeather(city = HOME_CITY) {
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
  ).then(r => r.json());
  const place = geo.results?.[0];
  if (!place) return { error: `City not found: ${city}` };

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`;
  const w = await fetch(url).then(r => r.json());

  return {
    city: place.name,
    temp: Math.round(w.current.temperature_2m),
    feelsLike: Math.round(w.current.apparent_temperature),
    condition: WEATHER_CODES[w.current.weather_code] || 'mixed weather',
    high: Math.round(w.daily.temperature_2m_max[0]),
    low: Math.round(w.daily.temperature_2m_min[0]),
    rainChance: w.daily.precipitation_probability_max[0],
    wind: Math.round(w.current.wind_speed_10m),
  };
}

// ---------- Agenda storage (a simple JSON file) ----------
function loadAgenda() {
  if (!fs.existsSync(FILE)) return []
  return JSON.parse(fs.readFileSync(FILE, 'utf8'))
}

function saveAgenda(items) {
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2))
}

// ---------- Tools the AI is allowed to use ----------
const tools = [
  {
    type: 'function',
    function: {
      name: 'add_event',
      description: 'Save a new commitment to the agenda. Only call this after the user said yes.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short name, e.g. Physics lecture' },
          start: { type: 'string', description: 'Local date and time, format YYYY-MM-DDTHH:mm' },
          location: { type: 'string' },
          remindBefore: {
            type: 'number',
            description: 'Minutes before start to remind the user. Default 10.',
          },
          repeat: {
            type: 'string',
            enum: ['none', 'daily', 'weekdays', 'weekly'],
            description: 'weekly repeats on the same weekday as start',
          },
        },
        required: ['title', 'start'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_events',
      description: 'Get all saved commitments with their ids',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_event',
      description: 'Remove a commitment by id. Only call this after the user said yes.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'number' } },
        required: ['id'],
      },
    },
  },
    {
    type: 'function',
    function: {
      name: 'update_event',
      description:
        'Change an existing commitment (new time, title, place or reminder). Call list_events first to get the id. Only call this after the user said yes.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
          start: { type: 'string', description: 'New local date and time, format YYYY-MM-DDTHH:mm' },
          location: { type: 'string' },
          remindBefore: { type: 'number' },
                    repeat: {
            type: 'string',
            enum: ['none', 'daily', 'weekdays', 'weekly'],
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_email',
      description:
        "List the newest emails in Sri's Gmail inbox (sender, subject, date, short preview, id). Read-only.",
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'How many emails, 1-10. Default 5.' },
          unreadOnly: { type: 'boolean', description: 'Only unread emails' },
          query: {
            type: 'string',
            description: 'Optional Gmail search, e.g. "from:amazon" or "subject:exam" or "newer_than:1d"',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_email',
      description: 'Get the full text of one email by its id (from check_email). Read-only.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_thing',
      description: 'Open a website or a Mac app for the user.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            enum: [...Object.keys(WEBSITES), ...Object.keys(APPS)],
          },
        },
        required: ['target'],
      },
    },
  },
  {
  type: 'function',
  function: {
    name: 'get_weather',
    description: "Get current weather and today's forecast. Use for weather, temperature, rain or what-to-wear questions.",
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name only, e.g. "Miami". Leave empty for the user\'s home city.' },
      },
    },
  },
},
]

async function runTool(name, args) {
  // 0. Email (read-only)
  if (name === 'check_email' || name === 'read_email') {
    if (!gmailConfigured()) return { error: 'Gmail is not set up yet (missing Google keys in .env).' }
    if (!gmailConnected()) return { error: 'Gmail is not connected. Ask Sri to click "Connect Gmail" on the screen.' }
    try {
      if (name === 'check_email') return { emails: await listEmails(args) }
      return { email: await readEmail(args.id) }
    } catch (err) {
      console.error(err)
      return { error: 'Could not reach Gmail right now.' }
    }
  }

  // 1. Open a website or app (checked first)
  if (name === 'open_thing') {
    if (WEBSITES[args.target]) {
      execFile('open', ['-a', 'Google Chrome', WEBSITES[args.target]])
      return { opened: args.target }
    }
    if (APPS[args.target]) {
      execFile('open', ['-a', APPS[args.target]])
      return { opened: args.target }
    }
    return { error: 'Not allowed' }
  }
  if (name === 'get_weather') {
  try {
    lastWeather = await getWeather(args.city || HOME_CITY);
    return lastWeather;
  } catch {
    return { error: 'Weather service not reachable' };
  }
}

  // 2. Agenda tools
  const items = loadAgenda()

  if (name === 'add_event') {
    const item = {
      id: Date.now(),
      title: args.title,
      start: args.start,
      location: args.location || '',
      remindBefore: args.remindBefore ?? 10,
      repeat: args.repeat || 'none',
    }
    items.push(item)
    saveAgenda(items)
    return { saved: item }
  }

  if (name === 'list_events') {
    return { events: items }
  }

  if (name === 'delete_event') {
    const left = items.filter((i) => i.id !== args.id)
    saveAgenda(left)
    return { deleted: left.length !== items.length }
  }
    if (name === 'update_event') {
    const item = items.find((i) => i.id === args.id)
    if (!item) return { error: 'Event not found' }
    if (args.title) item.title = args.title
    if (args.start) item.start = args.start
    if (args.location !== undefined) item.location = args.location
    if (args.remindBefore !== undefined) item.remindBefore = args.remindBefore
    if (args.repeat) item.repeat = args.repeat
    saveAgenda(items)
    return { updated: item }
  }

  // 3. Anything else
  return { error: 'Unknown tool' }
}

// ---------- The AI brain ----------
function nowLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())} (${weekday})`
}

function systemPrompt() {
  return `You are Asta, a fiery, loud, big-hearted anime hero who lives on the user's screen. The user's name is Sri.
The current local date and time is ${nowLocal()}.

Personality and conversation:
- You are an original character: a hot-blooded underdog with flame-red spiky hair and a red scarf who never, ever gives up. Never claim to be a character from any existing anime.
- You are Sri's loyal friend and biggest hype man first, assistant second. Chat naturally about anything: their day, questions, ideas, jokes, advice.
- Talk with huge energy and confidence: exclamations, "Let's go!", "Yosh!", calling challenges "a fight we're gonna win". Be warm, never mean.
- When Sri is tired, stressed or doubting themselves, fire them up: remind them that hard work beats everything and that you're in their corner.
- You're a bit of a goofball about everyday stuff, but serious and focused when Sri needs help.
- Occasionally ask a short follow-up question, but not every time.
- Remember what Sri said earlier in this conversation and refer back to it naturally.
- Only use tools when Sri asks about plans, reminders, email, or opening something. Small talk needs no tools.
- If you don't know something, say so honestly instead of guessing.

Speaking style:
- Everything you say is spoken out loud: no lists, markdown, emojis, or symbols.
- Usually 1–3 short sentences. Go a bit longer only when Sri asks you to explain something.

Agenda rules:
- Use the tools to read and change the agenda. Never invent events.
- Before adding: repeat the title, day and time, then ask "Should I save it?". Call add_event only after the user says yes.
- To change a plan: call list_events to find the id, say the old and new details, ask "Should I change it?", and call update_event only after the user says yes.
- Before deleting: call list_events to find the id, ask the user to confirm, and call delete_event only after they say yes.
- If the time or day is missing, ask for it.
- If the user says "remind me X minutes before", pass remindBefore. Otherwise reminders are 10 minutes before.
- For repeating plans set repeat to daily, weekdays or weekly. Weekly repeats on the same weekday as start. For "every Monday and Wednesday", create one weekly plan for each day.
Email rules (read-only, you can never send or delete):
- When Sri asks about email, call check_email. Summarize: how many, who they're from, and what each is about in a few words. Mention anything that looks urgent first.
- When Sri asks you to read one, call read_email and read it in a natural spoken way: who sent it, then the main point. Summarize long emails instead of reading every word; skip signatures, footers and legal text.
- Never read out passwords, verification codes or bank details from emails; just say the email contains one.
- If a tool says Gmail isn't connected, tell Sri to click "Connect Gmail".
- For weather questions call get_weather. Answer in one short sentence: temperature in °F, condition, and rain chance only if it is above 30%. If no city is named, use the user's home city.
- You can open websites and Mac apps with open_thing. Do it right away without asking, then say what you opened.`
}

async function askGroq(messages, retries = 1) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, tools }),
  })
  const data = await res.json()

  if (!res.ok) {
    // The model sometimes writes a broken tool call: just ask again once
    if (data.error?.code === 'tool_use_failed' && retries > 0) {
      console.log('Tool call glitch, retrying…')
      return askGroq(messages, retries - 1)
    }
    console.error('Groq error:', data)
    throw new Error('Groq request failed')
  }
  return data.choices[0].message
}

async function chat(messages) {
  // Fast path: "open gmail", "open my github", "open VS Code" – no AI needed
  const lastText = (messages[messages.length - 1]?.content || '')
    .toLowerCase()
    .replace(/[.!?,]/g, '')
  const match = lastText.match(/^(?:please\s+)?(?:open|launch|start)\s+(?:my\s+|the\s+)?(.+)$/)
  if (match) {
    const target = match[1].trim().replace(/\s+/g, '') // "vs code" -> "vscode"
    if (WEBSITES[target] || APPS[target]) {
      const result = await runTool('open_thing', { target })
      console.log('Quick command:', target)
      if (result.error) return "Sorry, I can't open that."
      return `Opening ${target}.`
    }
  }

  const convo = [{ role: 'system', content: systemPrompt() }, ...messages]

  // The AI may use several tools before it answers
  for (let step = 0; step < 5; step++) {
    const msg = await askGroq(convo)

    if (!msg.tool_calls) {
      return msg.content
    }

    convo.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls })

    const opened = []
    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments || '{}')
      const result = await runTool(call.function.name, args)
      console.log('Tool used:', call.function.name, args)
      if (result.opened) opened.push(result.opened)
      convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
    }

    // Opening apps needs no follow-up from the AI: answer right away
    if (opened.length === msg.tool_calls.length) {
      return `Opening ${opened.join(' and ')}.`
    }
  }
  return 'Sorry, that took too many steps. Please try again.'
}

// ---------- HTTP server ----------
function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/agenda') {
      return sendJson(res, 200, { agenda: loadAgenda() })
    }

    // ---------- Gmail sign-in ----------
    const url = new URL(req.url, 'http://localhost:3001')

    if (req.method === 'GET' && url.pathname === '/api/gmail/status') {
      return sendJson(res, 200, { configured: gmailConfigured(), connected: gmailConnected() })
    }

    if (req.method === 'GET' && url.pathname === '/api/gmail/auth') {
      if (!gmailConfigured()) return sendJson(res, 400, { error: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env first' })
      res.writeHead(302, { Location: authUrl() })
      return res.end()
    }

    if (req.method === 'GET' && url.pathname === '/api/gmail/callback') {
      const code = url.searchParams.get('code')
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        return res.end('<h2>Gmail was not connected.</h2><p>You can close this tab.</p>')
      }
      await finishSignIn(code)
      res.writeHead(200, { 'Content-Type': 'text/html' })
      return res.end('<h2>Gmail connected!</h2><p>Asta can now read your email. You can close this tab.</p>')
    }

      if (req.method === 'POST' && req.url === '/api/chat') {
      let body = ''
      for await (const chunk of req) body += chunk
      const { messages } = JSON.parse(body)
      lastWeather = null
      const reply = await chat(messages)
      return sendJson(res, 200, { reply, agenda: loadAgenda(), weather: lastWeather })
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error(err)
    sendJson(res, 500, { reply: 'Sorry, my brain is not working right now.', agenda: loadAgenda() })
  }
})

server.listen(3001, () => {
  console.log('Asta brain running on http://localhost:3001')
})