import http from 'node:http'
import fs from 'node:fs'
import { execFile } from 'node:child_process'

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
        },
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
]

function runTool(name, args) {
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

  // 2. Agenda tools
  const items = loadAgenda()

  if (name === 'add_event') {
    const item = {
      id: Date.now(),
      title: args.title,
      start: args.start,
      location: args.location || '',
      remindBefore: args.remindBefore ?? 10,
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
  return `You are Mini Astha, a friendly voice assistant that manages the user's schedule. The user's name is Sri.
The current local date and time is ${nowLocal()}.

Rules:
- Your answers are spoken out loud: keep them to 1–2 short sentences, no lists or symbols.
- Use the tools to read and change the agenda. Never invent events.
- Before adding: repeat the title, day and time, then ask "Should I save it?". Call add_event only after the user says yes.
- To change a plan: call list_events to find the id, say the old and new details, ask "Should I change it?", and call update_event only after the user says yes.
- Before deleting: call list_events to find the id, ask the user to confirm, and call delete_event only after they say yes.
- If the time or day is missing, ask for it.
- If the user says "remind me X minutes before", pass remindBefore. Otherwise reminders are 10 minutes before.
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
      const result = runTool('open_thing', { target })
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
      const result = runTool(call.function.name, args)
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

    if (req.method === 'POST' && req.url === '/api/chat') {
      let body = ''
      for await (const chunk of req) body += chunk
      const { messages } = JSON.parse(body)

      const reply = await chat(messages)
      return sendJson(res, 200, { reply, agenda: loadAgenda() })
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error(err)
    sendJson(res, 500, { reply: 'Sorry, my brain is not working right now.', agenda: loadAgenda() })
  }
})

server.listen(3001, () => {
  console.log('Mini Astha brain running on http://localhost:3001')
})