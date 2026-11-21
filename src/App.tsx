import { useEffect, useRef, useState } from 'react'
import './App.css'

type Status = 'standby' | 'listening' | 'thinking' | 'speaking'
type AgendaItem = { id: number; title: string; start: string; location: string; remindBefore?: number }

// Very forgiving check, based on what Chrome actually heard:
// "hey hasta", "hey hast", "hey astha", "hasta", "hairst", "hairstyle"...
// Very forgiving check, based on what Chrome actually heard
function isWakeWord(text: string) {
  const clean = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
  return (
    /\b(hey|hi|hay|ok|okay)\s+h?a+s+h?t+h?a*\b/.test(clean) || // hey astha, hey hasta, hey hast
    /\b(hey|hi|hay|ok|okay)\s+(austin|aston|astin|astra|aster|esther)\b/.test(clean) || // hey austin, hey astra
    /\bh?a+s+h?t+h?a+\b/.test(clean) || // astha / hasta on its own
    /\bhairst/.test(clean) // hairst, hairstyle, hairstra
  )
}

function getRecognizer() {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  return SpeechRecognition ? new SpeechRecognition() : null
}

function App() {
  const [status, setStatus] = useState<Status>('standby')
  const [heard, setHeard] = useState('')
  const [reply, setReply] = useState('')
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [awake, setAwake] = useState(true)
  const [wakeMode, setWakeMode] = useState(false)

  const recognitionRef = useRef<any>(null)
  const wakeRecognitionRef = useRef<any>(null)
  const wakeModeRef = useRef(false)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
      const remindedRef = useRef<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('reminded') || '[]'))
  )

  // Load saved plans when the app opens
  useEffect(() => {
    fetch('/api/agenda')
      .then((res) => res.json())
      .then((data) => setAgenda(data.agenda))
      .catch(() => {})
  }, [])

  // Wake-word mode: after 8 quiet seconds, go to sleep and wait for "Hey Astha"
    // Reminders: every 15 seconds, check if a plan is coming up
  useEffect(() => {
    function checkReminders() {
      if (status !== 'standby') return // don't interrupt a conversation

      const now = Date.now()
      for (const item of agenda) {
        const start = new Date(item.start).getTime()
        const before = (item.remindBefore ?? 10) * 60 * 1000
        const isDue = now >= start - before && now < start

        const key = `${item.id}@${item.start}` // new time = new reminder
        if (isDue && !remindedRef.current.has(key)) {
          remindedRef.current.add(key)
          localStorage.setItem('reminded', JSON.stringify([...remindedRef.current]))

          const mins = Math.max(1, Math.round((start - now) / 60000))
          const place = item.location ? ` at ${item.location}` : ''
          const message = `Sri, ${item.title} starts in ${mins} minute${mins === 1 ? '' : 's'}${place}.`

          // 1. Mac notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Mini Astha', { body: message })
          }

          // 2. Wake up if sleeping, then say it out loud
          if (!awake) {
            stopWakeListener()
            setAwake(true)
          }
          speak(message)
          return // one reminder at a time
        }
      }
    }

    checkReminders()
    const timer = setInterval(checkReminders, 15000)
    return () => clearInterval(timer)
  }, [agenda, status, awake])
  useEffect(() => {
    if (!wakeMode || !awake || status !== 'standby') return
    const timer = setTimeout(() => {
      setAwake(false)
      setHeard('')
      setReply('')
      listenForWakeWord()
    }, 8000)
    return () => clearTimeout(timer)
  }, [wakeMode, awake, status])

  // ---------- Wake word ----------
  function listenForWakeWord() {
    const recognition = getRecognizer()
    if (!recognition) return

    recognition.continuous = true
    recognition.interimResults = true
        recognition.lang = 'en-IN' // Indian English knows the name "Astha" better

    let woke = false

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1][0].transcript.toLowerCase()
      console.log('Wake listener heard:', last)
        if (isWakeWord(last)) {
        woke = true
        recognition.stop()
      }
    }

    recognition.onend = () => {
      if (woke) wakeUp()
      // Chrome stops listening after a while: start again
      else if (wakeModeRef.current) setTimeout(listenForWakeWord, 300)
    }

    wakeRecognitionRef.current = recognition
    recognition.start()
  }

  function stopWakeListener() {
    const r = wakeRecognitionRef.current
    if (r) {
      r.onend = null
      r.stop()
    }
  }

  function wakeUp() {
    setAwake(true)
    setHeard('')
    setReply('')
    speak('Yes?') // ends with "?" so the mic turns on for your command
  }

  function toggleWakeMode() {
        if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    if (wakeModeRef.current) {
      wakeModeRef.current = false
      setWakeMode(false)
      stopWakeListener()
      setAwake(true)
    } else {
      wakeModeRef.current = true
      setWakeMode(true)
    }
  }

  // ---------- Conversation ----------
  function speak(text: string) {
    setStatus('speaking')
    setReply(text)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => {
      if (text.trim().endsWith('?')) startListening()
      else setStatus('standby')
    }
    window.speechSynthesis.speak(utterance)
  }

  async function think(text: string) {
    setStatus('thinking')
    historyRef.current.push({ role: 'user', content: text })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyRef.current.slice(-10) }),
      })
      const data = await res.json()
      historyRef.current.push({ role: 'assistant', content: data.reply })
      setAgenda(data.agenda)
      speak(data.reply)
    } catch {
      speak('Sorry, I could not reach my brain. Is the server running?')
    }
  }

  function startListening() {
    const recognition = getRecognizer()
    if (!recognition) {
      setReply('Voice input does not work in this browser. Please use Chrome.')
      return
    }

    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false

    let latest = ''

    recognition.onresult = (event: any) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      latest = text
      setHeard(text)
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setReply('Microphone is blocked. Allow it in the browser and try again.')
      }
    }

    recognition.onend = () => {
      if (latest) think(latest)
      else setStatus('standby')
    }

    recognitionRef.current = recognition
    setHeard('')
    setStatus('listening')
    recognition.start()
  }

  function handleClick() {
        if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    // Sleeping? A click wakes her up too
    if (!awake) {
      stopWakeListener()
      wakeUp()
      return
    }

    if (status === 'standby') {
      setReply('')
      startListening()
    } else if (status === 'listening') {
      recognitionRef.current?.stop()
    } else if (status === 'speaking') {
      window.speechSynthesis.cancel()
      setStatus('standby')
    }
  }

  const upcoming = [...agenda]
    .filter((item) => new Date(item.start) >= new Date(new Date().toDateString()))
    .sort((a, b) => a.start.localeCompare(b.start))

  return (
    <div className={`screen ${status}`}>
      <aside className="agenda">
        <p className="agenda-title">UPCOMING</p>
        {upcoming.length === 0 && <p className="agenda-empty">No plans yet. Ask me to add one.</p>}
        {upcoming.map((item) => (
          <div key={item.id} className="agenda-item">
            <span className="agenda-time">
              {new Date(item.start).toLocaleString('en-US', {
                weekday: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            <span className="agenda-name">{item.title}</span>
            {item.location && <span className="agenda-place">{item.location}</span>}
          </div>
        ))}
      </aside>

      <button className={`wake-toggle ${wakeMode ? 'on' : ''}`} onClick={toggleWakeMode}>
        {wakeMode ? '● "Hey Astha" is on' : '○ Turn on "Hey Astha"'}
      </button>

      <p className="brand">Mini Astha</p>

      <button className={`orb ${awake ? '' : 'asleep'}`} onClick={handleClick} aria-label="Talk to Mini Astha">
        <div className="ring ring-outer"></div>
        <div className="ring ring-dashed"></div>
        <div className="ring ring-arc"></div>
        <div className="ring ring-arc-reverse"></div>

        <div className="orbit" style={{ transform: 'rotate(0deg) scaleY(0.35)' }}>
          <div className="orbit-spin" style={{ animationDuration: '5s' }}>
            <div className="electron"></div>
          </div>
        </div>
        <div className="orbit" style={{ transform: 'rotate(60deg) scaleY(0.35)' }}>
          <div className="orbit-spin" style={{ animationDuration: '7s' }}>
            <div className="electron"></div>
          </div>
        </div>
        <div className="orbit" style={{ transform: 'rotate(120deg) scaleY(0.35)' }}>
          <div className="orbit-spin" style={{ animationDuration: '9s' }}>
            <div className="electron"></div>
          </div>
        </div>

        <div className="signal"></div>
        <div className="signal signal-2"></div>
        <div className="signal signal-3"></div>

        <div className="core"></div>
      </button>

      <p className="status">{awake ? status.toUpperCase() : 'SLEEPING'}</p>

      <div className="transcript">
        {!awake && <p className="hint">Say “Hey Astha” to wake me</p>}
        {awake && status === 'standby' && !heard && !reply && <p className="hint">Click the core and speak</p>}
        {awake && heard && <p className="heard">“{heard}”</p>}
        {awake && reply && <p className="reply">{reply}</p>}
      </div>
    </div>
  )
}

export default App