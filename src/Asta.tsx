import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from 'react'
import './Asta.css'
import AstaDrawing from './AstaDrawing'

// The 3D code (three.js) is only downloaded when public/asta.vrm exists
const AstaVrm = lazy(() => import('./AstaVrm'))

export type AstaMood = 'standby' | 'listening' | 'thinking' | 'speaking' | 'sleeping'

type Props = {
  mood: AstaMood
  mouth: RefObject<number> // 0 = closed … 1 = wide open, written every frame
  waveKey: number // change this number to make Asta wave
  onClick: () => void
}

const WIDTH = 180
const SPEED = 140 // walking speed in pixels per second
const MODEL_URL = '/asta.vrm'

export default function Asta({ mood, mouth, waveKey, onClick }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const posRef = useRef({ x: window.innerWidth / 2 + 150, target: window.innerWidth / 2 + 150 })
  const moodRef = useRef(mood)
  const [walking, setWalking] = useState(false)
  const [facing, setFacing] = useState<1 | -1>(-1)
  const [waving, setWaving] = useState(false)
  const [hasModel, setHasModel] = useState(false)
  const [action, setAction] = useState<'' | 'jump' | 'stretch' | 'pump'>('')
  const facingRef = useRef<1 | -1>(-1)
  const mouseRef = useRef({ x: 0, y: 0, movedAt: 0 })

  useEffect(() => {
    moodRef.current = mood
  }, [mood])

  // Remember where the mouse is, so Asta's eyes can follow it
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, movedAt: performance.now() }
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // Random idle moves while he's just hanging around
  useEffect(() => {
    if (mood !== 'standby' || walking) return
    let clear: ReturnType<typeof setTimeout>
    const start = setTimeout(() => {
      const moves = ['jump', 'stretch', 'pump'] as const
      setAction(moves[Math.floor(Math.random() * moves.length)])
      clear = setTimeout(() => setAction(''), 1400)
    }, 3000 + Math.random() * 5000)
    return () => {
      clearTimeout(start)
      clearTimeout(clear)
      setAction('')
    }
  }, [mood, walking])

  // Use the 3D model if the user put one in public/asta.vrm
  useEffect(() => {
    fetch(MODEL_URL, { method: 'HEAD' })
      .then((res) => {
        const type = res.headers.get('content-type') || ''
        setHasModel(res.ok && !type.includes('text/html')) // Vite answers missing files with index.html
      })
      .catch(() => {})
  }, [])

  // Wave when woken up
  useEffect(() => {
    if (waveKey === 0) return
    setWaving(true)
    const t = setTimeout(() => setWaving(false), 1800)
    return () => clearTimeout(t)
  }, [waveKey])

  // Where should Asta go?
  useEffect(() => {
    const maxX = () => window.innerWidth - WIDTH - 20

    // Busy talking with you: come stand next to the core
    if (mood === 'listening' || mood === 'thinking' || mood === 'speaking') {
      posRef.current.target = Math.min(window.innerWidth / 2 + 150, maxX())
      return
    }
    if (mood === 'sleeping') {
      posRef.current.target = posRef.current.x // stay put and nap
      return
    }

    // Idle: wander to a random spot every few seconds
    let timer: ReturnType<typeof setTimeout>
    const wander = () => {
      posRef.current.target = 20 + Math.random() * (maxX() - 20)
      timer = setTimeout(wander, 5000 + Math.random() * 5000)
    }
    timer = setTimeout(wander, 2500)
    return () => clearTimeout(timer)
  }, [mood])

  // Animation loop: walking + mouth
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    let wasWalking = false
    let lastFacing = -1
    const look = { x: 0, y: 0, glanceX: 0, glanceY: 0, nextGlance: 0 }

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const p = posRef.current
      const maxX = window.innerWidth - WIDTH - 20
      p.target = Math.max(20, Math.min(p.target, maxX))

      const gap = p.target - p.x
      const isWalking = Math.abs(gap) > 2
      if (isWalking) {
        p.x += Math.sign(gap) * Math.min(Math.abs(gap), SPEED * dt)
        const dir = gap > 0 ? 1 : -1
        if (dir !== lastFacing) {
          lastFacing = dir
          facingRef.current = dir
          setFacing(dir)
        }
      }
      if (isWalking !== wasWalking) {
        wasWalking = isWalking
        setWalking(isWalking)
      }
      if (rootRef.current) rootRef.current.style.transform = `translateX(${p.x}px)`

      // Eyes: look at the mouse, glance around when it's still, look up while thinking
      const m = mouseRef.current
      const headX = p.x + WIDTH / 2
      const headY = window.innerHeight - 64 - 160
      let wantX: number
      let wantY: number
      if (moodRef.current === 'thinking') {
        wantX = 0.6
        wantY = -1
      } else if (isWalking) {
        wantX = Math.sign(gap) // look where he's running
        wantY = 0
      } else if (now - m.movedAt < 3000) {
        wantX = (m.x - headX) / 350
        wantY = (m.y - headY) / 350
      } else {
        if (now > look.nextGlance) {
          look.glanceX = Math.random() * 2 - 1
          look.glanceY = Math.random() * 1.2 - 0.6
          look.nextGlance = now + 1200 + Math.random() * 2000
        }
        wantX = look.glanceX
        wantY = look.glanceY
      }
      wantX = Math.max(-1, Math.min(1, wantX))
      wantY = Math.max(-1, Math.min(1, wantY))
      look.x += (wantX - look.x) * 0.2
      look.y += (wantY - look.y) * 0.2
      // The drawing is mirrored when he faces left, so mirror the eyes back
      rootRef.current?.style.setProperty('--look-x', (look.x * facingRef.current).toFixed(3))
      rootRef.current?.style.setProperty('--look-y', look.y.toFixed(3))

      // Lip-sync: a natural-looking flap while speaking, plus a pop on every spoken word
      if (mouth.current !== null) {
        const t = now / 1000
        const pulse = mouth.current * 0.85 // word pulses fade out
        const flap =
          moodRef.current === 'speaking'
            ? 0.2 + 0.6 * Math.abs(Math.sin(t * 11)) * (0.6 + 0.4 * Math.sin(t * 2.7))
            : 0
        mouth.current = pulse
        const open = Math.max(pulse, flap)
        rootRef.current?.style.setProperty('--mouth', open.toFixed(3))
      }

      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [mouth])

  const classes = ['asta', `mood-${mood}`, walking && 'walking', waving && 'waving', action && `act-${action}`]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={rootRef} className={classes} onClick={onClick} role="button" aria-label="Talk to Asta">
      {mood === 'thinking' && <div className="asta-bubble">…</div>}
      {mood === 'sleeping' && <div className="asta-zzz">z Z z</div>}

      <div className="asta-flip" style={{ transform: `scaleX(${facing})` }}>
        {hasModel ? (
          <Suspense fallback={<AstaDrawing />}>
            <AstaVrm url={MODEL_URL} mood={mood} walking={walking} waving={waving} rootRef={rootRef} />
          </Suspense>
        ) : (
          <AstaDrawing />
        )}
      </div>
    </div>
  )
}

