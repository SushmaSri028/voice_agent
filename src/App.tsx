import { useEffect, useRef, useState } from 'react'
import './App.css'

type Status = 'standby' | 'listening' | 'thinking' | 'speaking'
type AgendaItem = { id: number; title: string; start: string; location: string }

function App() {
  const [status, setStatus] = useState<Status>('standby')
  const [heard, setHeard] = useState('')
  const [reply, setReply] = useState('')
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const recognitionRef = useRef<any>(null)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  // Load saved plans when the app opens
  useEffect(() => {
    fetch('/api/agenda')
      .then((res) => res.json())
      .then((data) => setAgenda(data.agenda))
      .catch(() => {})
  }, [])

  // 3. Speak the reply out loud
  function speak(text: string) {
    setStatus('speaking')
    setReply(text)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => {
      // If Mini Astha asked a question, listen for the answer automatically
      if (text.trim().endsWith('?')) startListening()
      else setStatus('standby')
    }
    window.speechSynthesis.speak(utterance)
  }

  // 2. Ask the AI brain
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

  // 1. Listen to the microphone
  function startListening() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setReply('Voice input does not work in this browser. Please use Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
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

  // Upcoming plans, soonest first
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

      <p className="brand">Mini Astha</p>

      <button className="orb" onClick={handleClick} aria-label="Talk to Mini Astha">
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

      <p className="status">{status.toUpperCase()}</p>

      <div className="transcript">
        {status === 'standby' && !heard && !reply && <p className="hint">Click the core and speak</p>}
        {heard && <p className="heard">“{heard}”</p>}
        {reply && <p className="reply">{reply}</p>}
      </div>
    </div>
  )
}

export default App