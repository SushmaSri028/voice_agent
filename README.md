# Mini Astha 🎙️

A voice-first AI assistant with an animated "energy core" interface. Talk to it, and it listens, thinks and answers out loud. It can also manage your schedule: add plans, read them back and cancel them, always asking before it changes anything.

> Built step by step as a learning project with React, TypeScript and an AI agent that uses tools.

## Features

- **Animated voice core:** rotating rings, orbiting electrons and signal waves that react to each state (standby, listening, thinking, speaking)
- **Speech in, speech out:** uses the browser's built-in speech recognition and text-to-speech
- **AI brain:** powered by Groq (`openai/gpt-oss-20b`) through a small Node server, so the API key never reaches the browser
- **Agenda tools (function calling):** the AI can `add_event`, `list_events` and `delete_event`, and confirms before saving or deleting
- **Hands-free follow-up:** when the assistant asks a question, the mic turns on automatically for your answer
- **Conversation memory:** remembers the last 10 messages for follow-up questions
- **Upcoming panel:** shows your saved plans, soonest first

## How it works

```
Browser (React)                Node server                 Groq AI
───────────────                ───────────                 ───────
🎤 Speech → text   ──/api/chat──►  adds system prompt  ──►  decides: answer
🔊 Text → speech   ◄── reply ───  runs tools          ◄──  or use a tool
📋 Upcoming list   ◄─ agenda ──   agenda.json
```

## Tech stack

| Part | Technology |
|---|---|
| UI | React, TypeScript, CSS animations |
| Build tool | Vite |
| Voice | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| Server | Node.js (built-in `http`, `fs`) |
| AI | Groq API with tool calling |
| Storage | Local JSON file (`agenda.json`) |

## Getting started

### Requirements

- [Node.js](https://nodejs.org) 20.6 or newer
- A free [Groq API key](https://console.groq.com)
- Google Chrome (best support for voice input)

### Setup

```bash
git clone https://github.com/SushmaSri028/voice_agent.git
cd voice_agent
npm install
```

Create a `.env` file in the project root:

```
GROQ_API_KEY=your_key_here
```

### Run

Open two terminals:

```bash
# Terminal 1 – AI brain (server)
node --env-file=.env server.js
```

```bash
# Terminal 2 – app
npm run dev
```

Open http://localhost:5173 in Chrome, click the core and start talking.

## Try saying

- "Add physics lecture tomorrow at 10 am in room 204" → "Yes"
- "What do I have tomorrow?"
- "Cancel the physics lecture"
- "Give me a tip to focus while studying"

## Project structure

```
voice_agent/
├── server.js        # Node server: AI brain, tools, agenda storage
├── src/
│   ├── App.tsx      # Voice flow, states, agenda panel
│   ├── App.css      # Core animations and styles
│   └── main.tsx     # React entry point
├── vite.config.ts   # Proxies /api to the server
└── .env             # Your API key (not committed)
```

## Roadmap

- [ ] Reminders before each plan (notifications + spoken alert)
- [ ] Reschedule plans (`update_event` tool)
- [ ] Recurring plans (every Monday, weekdays…)
- [ ] Telugu / Tenglish voice support
- [ ] Desktop app with Electron and a global shortcut
- [ ] Mobile app with React Native

## Security

- The Groq API key lives only in `.env` on the server and is listed in `.gitignore`.
- `agenda.json` (personal plans) is also ignored.

## Author

**Sushma Sri Kondamareddy**: [GitHub](https://github.com/SushmaSri028)