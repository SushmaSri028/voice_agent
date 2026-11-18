import http from 'node:http'
import fs from 'node:fs'

const FILE = './agenda.json'
const MODEL = 'openai/gpt-oss-20b'

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
]

function runTool(name, args) {
  const items = loadAgenda()

  if (name === 'add_event') {
    const item = { id: Date.now(), title: args.title, start: args.start, location: args.location || '' }
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
  return `You are Mini Astha, a friendly voice assistant that manages the user's schedule.
The current local date and time is ${nowLocal()}.

Rules:
- Your answers are spoken out loud: keep them to 1–2 short sentences, no lists or symbols.
- Use the tools to read and change the agenda. Never invent events.
- Before adding: repeat the title, day and time, then ask "Should I save it?". Call add_event only after the user says yes.
- Before deleting: call list_events to find the id, ask the user to confirm, and call delete_event only after they say yes.
- If the time or day is missing, ask for it.`
}

async function askGroq(messages) {
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
    console.error('Groq error:', data)
    throw new Error('Groq request failed')
  }
  return data.choices[0].message
}

async function chat(messages) {
  const convo = [{ role: 'system', content: systemPrompt() }, ...messages]

  // The AI may use several tools before it answers
  for (let step = 0; step < 5; step++) {
    const msg = await askGroq(convo)

    if (!msg.tool_calls) {
      return msg.content
    }

    convo.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls })

    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments || '{}')
      const result = runTool(call.function.name, args)
      console.log('Tool used:', call.function.name, args)
      convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
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