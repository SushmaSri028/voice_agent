// Read-only Gmail access for Asta.
// Uses Google's OAuth "installed app" flow with the gmail.readonly scope:
// Asta can read mail but can never send, delete or change anything.
import fs from 'node:fs'

const TOKEN_FILE = './gmail-token.json' // your login token, never committed (.gitignore)
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const REDIRECT_URI = 'http://localhost:3001/api/gmail/callback'
const API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const MAX_BODY_CHARS = 3000 // only this much of an email is sent to the AI

function clientId() {
  return process.env.GOOGLE_CLIENT_ID
}
function clientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET
}

export function gmailConfigured() {
  return Boolean(clientId() && clientSecret())
}

export function gmailConnected() {
  return fs.existsSync(TOKEN_FILE)
}

// ---------- Sign-in ----------
export function authUrl() {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline', // gives a refresh token so you only sign in once
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

async function tokenRequest(body) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...body }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Google token error: ${data.error_description || data.error}`)
  return data
}

export async function finishSignIn(code) {
  const data = await tokenRequest({ code, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' })
  saveToken(data)
}

function saveToken(data) {
  const old = gmailConnected() ? JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) : {}
  const token = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || old.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2))
  return token
}

async function accessToken() {
  if (!gmailConnected()) throw new Error('not_connected')
  let token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
  if (Date.now() >= token.expires_at) {
    const data = await tokenRequest({ refresh_token: token.refresh_token, grant_type: 'refresh_token' })
    token = saveToken(data)
  }
  return token.access_token
}

async function gmail(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await accessToken()}` } })
  const data = await res.json()
  if (!res.ok) throw new Error(`Gmail error: ${data.error?.message || res.status}`)
  return data
}

// ---------- Reading mail ----------
function header(msg, name) {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

function decode(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

// Find the readable text of an email (plain text preferred, HTML stripped as fallback)
function bodyText(payload) {
  const parts = []
  const walk = (p) => {
    if (!p) return
    if (p.body?.data) parts.push({ type: p.mimeType, text: decode(p.body.data) })
    p.parts?.forEach(walk)
  }
  walk(payload)

  const plain = parts.find((p) => p.type === 'text/plain')
  if (plain) return plain.text
  const html = parts.find((p) => p.type === 'text/html')
  if (!html) return ''
  return html.text
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
}

function clean(text) {
  return text
    .replace(/https?:\/\/\S+/g, '[link]') // long tracking links are useless when spoken
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_BODY_CHARS)
}

export async function listEmails({ count = 5, unreadOnly = false, query = '' } = {}) {
  const max = Math.min(Math.max(count, 1), 10)
  const q = [unreadOnly ? 'is:unread' : '', 'in:inbox', query].filter(Boolean).join(' ')
  const list = await gmail(`/messages?maxResults=${max}&q=${encodeURIComponent(q)}`)
  if (!list.messages) return []

  return Promise.all(
    list.messages.map(async ({ id }) => {
      const msg = await gmail(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)
      return {
        id,
        from: header(msg, 'From'),
        subject: header(msg, 'Subject'),
        date: header(msg, 'Date'),
        unread: msg.labelIds?.includes('UNREAD') || false,
        preview: msg.snippet,
      }
    }),
  )
}

export async function readEmail(id) {
  const msg = await gmail(`/messages/${encodeURIComponent(id)}?format=full`)
  return {
    id,
    from: header(msg, 'From'),
    subject: header(msg, 'Subject'),
    date: header(msg, 'Date'),
    body: clean(bodyText(msg.payload)) || msg.snippet,
  }
}
