// Asta: an original fiery shonen-hero character drawn in SVG, anime cel-shaded style.
// Part names (body, head, spike, arm-r, iris, mouth-open …) are animated from Asta.css.

// Flame spikes of the back hair: [path without closing edge, base point it sways around]
const SPIKES: [string, string][] = [
  ['M44 94 L14 78 L40 68', '42px 82px'],
  ['M40 74 L20 38 L58 54', '48px 64px'],
  ['M54 60 L52 10 L78 48', '64px 54px'],
  ['M74 52 L92 0 L108 48', '90px 50px'],
  ['M102 48 L130 8 L126 58', '114px 52px'],
  ['M122 56 L160 34 L142 74', '132px 64px'],
  ['M138 70 L168 78 L136 94', '138px 82px'],
]

const INK = '#24120e'

export default function AstaDrawing() {
  return (
    <svg className="asta-svg" viewBox="0 0 180 260" width="180" height="260">
      <defs>
        <linearGradient id="asta-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc83a" />
          <stop offset="0.4" stopColor="#ff6a1f" />
          <stop offset="1" stopColor="#c8102e" />
        </linearGradient>
        <linearGradient id="asta-jacket" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#323850" />
          <stop offset="0.55" stopColor="#262b3e" />
          <stop offset="0.56" stopColor="#1a1e2c" /> {/* hard cel-shade edge */}
          <stop offset="1" stopColor="#1a1e2c" />
        </linearGradient>
        <radialGradient id="asta-aura" cx="0.5" cy="0.7" r="0.6">
          <stop offset="0" stopColor="#fff1a8" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#ffb020" stopOpacity="0.7" />
          <stop offset="0.7" stopColor="#ff4d1a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff2a00" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* fire aura (shows while talking / fired up) */}
      <g className="aura">
        <path
          className="flame flame-1"
          d="M90 252 Q14 226 34 146 Q44 96 64 62 Q70 104 88 70 Q98 26 112 62 Q122 92 132 66 Q158 128 146 200 Q136 242 90 252 Z"
          fill="url(#asta-aura)"
        />
        <path
          className="flame flame-2"
          d="M90 250 Q26 222 46 156 Q56 120 72 96 Q78 124 92 100 Q102 72 112 98 Q122 118 128 104 Q148 150 138 204 Q128 238 90 250 Z"
          fill="url(#asta-aura)"
        />
      </g>

      {/* ground shadow */}
      <ellipse className="shadow" cx="90" cy="250" rx="46" ry="6" fill="rgba(0,0,0,0.4)" />

      {/* dust puffs while running */}
      <circle className="dust dust-1" cx="66" cy="246" r="6" fill="#c9b8a6" />
      <circle className="dust dust-2" cx="112" cy="246" r="5" fill="#c9b8a6" />

      <g className="body">
        {/* legs */}
        <g className="leg leg-l">
          <rect x="69" y="196" width="17" height="46" rx="6" fill="#2d3346" stroke={INK} strokeWidth="2.5" />
          <rect x="79" y="198" width="7" height="42" fill="#222739" />
          <rect x="69" y="226" width="17" height="4" fill="#ff7a1a" />
          <path d="M63 248 L63 240 Q63 233 72 233 L86 233 L88 248 Z" fill="#3a2a22" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
        <g className="leg leg-r">
          <rect x="94" y="196" width="17" height="46" rx="6" fill="#2d3346" stroke={INK} strokeWidth="2.5" />
          <rect x="104" y="198" width="7" height="42" fill="#222739" />
          <rect x="94" y="226" width="17" height="4" fill="#ff7a1a" />
          <path d="M92 248 L92 233 L108 233 Q117 233 117 240 L118 248 Z" fill="#3a2a22" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        </g>

        <g className="upper">
          {/* scarf tail */}
          <path
            className="scarf-tail"
            d="M72 142 Q46 150 26 174 Q42 171 48 179 Q60 162 82 150 Z"
            fill="#e0262f"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* back arm */}
          <g className="arm arm-l">
            <rect x="43" y="146" width="18" height="48" rx="8" fill="#323850" stroke={INK} strokeWidth="2.5" />
            <rect x="44" y="186" width="16" height="6" rx="2" fill="#ff7a1a" />
            <circle cx="52" cy="198" r="8.5" fill="#ffd9c2" stroke={INK} strokeWidth="2.5" />
          </g>

          {/* training jacket with a cel-shaded side */}
          <path d="M55 146 Q90 134 125 146 L131 204 Q90 214 49 204 Z" fill="url(#asta-jacket)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M90 146 L90 208" stroke="#ff7a1a" strokeWidth="2.5" />
          <path d="M60 168 Q66 186 62 200" stroke="#454c68" strokeWidth="2" fill="none" />
          <circle cx="108" cy="166" r="6" fill="none" stroke="#ff7a1a" strokeWidth="2" />
          <path d="M105 166 L108 162 L111 166 L108 170 Z" fill="#ff7a1a" />

          {/* front arm (fist pumps) */}
          <g className="arm arm-r">
            <rect x="119" y="146" width="18" height="48" rx="8" fill="#262b3e" stroke={INK} strokeWidth="2.5" />
            <rect x="120" y="186" width="16" height="6" rx="2" fill="#ff7a1a" />
            <circle cx="128" cy="198" r="9" fill="#ffd9c2" stroke={INK} strokeWidth="2.5" />
            <path d="M122 197 L134 197 M123 201 L133 201" stroke="#d99a80" strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* scarf around the neck */}
          <path d="M65 139 Q90 150 115 139 L117 151 Q90 162 63 151 Z" fill="#e0262f" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M68 147 Q90 156 112 147" stroke="#a80f1a" strokeWidth="2" fill="none" />

          {/* ---------- head ---------- */}
          <g className="head">
            <g className="hair-back">
              <path d="M38 106 Q34 54 90 50 Q146 54 142 106 Z" fill="url(#asta-hair)" stroke={INK} strokeWidth="2.5" />
              {SPIKES.map(([d, origin], i) => (
                <path
                  key={d}
                  className="spike"
                  d={d}
                  fill="url(#asta-hair)"
                  stroke={INK}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  style={{ transformOrigin: origin, animationDelay: `${-i * 0.23}s` }}
                />
              ))}
            </g>

            <rect x="83" y="126" width="14" height="15" rx="4" fill="#eab79c" stroke={INK} strokeWidth="2" />

            {/* face */}
            <ellipse cx="90" cy="100" rx="44" ry="41" fill="#ffd9c2" stroke={INK} strokeWidth="2.5" />
            <path d="M52 90 Q90 78 128 90 L130 100 Q90 88 50 100 Z" fill="#f2b799" opacity="0.8" /> {/* shadow under fringe */}
            <path d="M60 128 Q90 146 120 128 Q90 140 60 128 Z" fill="#f2b799" opacity="0.6" /> {/* chin shade */}
            <ellipse cx="46" cy="104" rx="6" ry="9" fill="#ffcdb3" stroke={INK} strokeWidth="2" />
            <ellipse cx="134" cy="104" rx="6" ry="9" fill="#ffcdb3" stroke={INK} strokeWidth="2" />

            {/* eyes */}
            <g className="eyes-open">
              <g className="eye eye-l">
                <path d="M61 103 Q72 90 84 100 L83 112 Q72 118 62 111 Z" fill="#fff" />
                <g className="iris">
                  <ellipse cx="73" cy="104" rx="6.8" ry="8.4" fill="#3fa9ff" />
                  <ellipse cx="73" cy="107" rx="6" ry="5" fill="#1f7fe0" />
                  <ellipse cx="73" cy="105" rx="3.4" ry="4.8" fill="#0b2a55" />
                  <circle cx="75.6" cy="101" r="2.4" fill="#fff" />
                  <circle cx="70.5" cy="108.5" r="1.2" fill="#fff" />
                </g>
                <path d="M60 101 Q72 87 85 99" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
              </g>
              <g className="eye eye-r">
                <path d="M96 100 Q108 90 119 103 L118 111 Q108 118 97 112 Z" fill="#fff" />
                <g className="iris">
                  <ellipse cx="107" cy="104" rx="6.8" ry="8.4" fill="#3fa9ff" />
                  <ellipse cx="107" cy="107" rx="6" ry="5" fill="#1f7fe0" />
                  <ellipse cx="107" cy="105" rx="3.4" ry="4.8" fill="#0b2a55" />
                  <circle cx="109.6" cy="101" r="2.4" fill="#fff" />
                  <circle cx="104.5" cy="108.5" r="1.2" fill="#fff" />
                </g>
                <path d="M95 99 Q108 87 120 101" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
              </g>
              <g className="eyelids">
                <rect x="58" y="86" width="28" height="32" fill="#ffd9c2" />
                <rect x="94" y="86" width="28" height="32" fill="#ffd9c2" />
              </g>
            </g>
            <g className="eyes-closed">
              <path d="M62 106 Q72 113 84 106" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M96 106 Q108 113 118 106" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
            </g>

            {/* blush + cheek bandage */}
            <ellipse className="blush" cx="62" cy="118" rx="7" ry="3" fill="#ff7f8f" opacity="0.35" />
            <g transform="rotate(-18 116 118)">
              <rect x="107" y="114" width="18" height="7" rx="2" fill="#f7dfbf" stroke={INK} strokeWidth="1.5" />
              <path d="M113 115 L113 120 M119 115 L119 120" stroke="#c99b70" strokeWidth="1" />
            </g>

            {/* mouth: big grin, plus an opening that follows --mouth */}
            <path className="smile" d="M74 120 Q90 135 106 120 Q90 128 74 120 Z" fill="#7a1e2a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <g className="mouth-open">
              <ellipse cx="90" cy="125" rx="9" ry="9" fill="#5c1420" stroke={INK} strokeWidth="2" />
              <ellipse cx="90" cy="130" rx="5" ry="3" fill="#ff6b7a" />
            </g>
            <path d="M96 122 L99 130 L102 122 Z" fill="#fff" stroke={INK} strokeWidth="1" strokeLinejoin="round" />

            {/* spiky bangs falling over the forehead + shine */}
            <g className="fringe">
              <path
                d="M42 100 Q40 58 90 54 Q140 58 138 100 L130 82 L124 94 L114 76 L106 88 L96 72 L88 87 L78 72 L70 88 L62 76 L56 92 L50 82 Z"
                fill="url(#asta-hair)"
                stroke={INK}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path d="M62 66 Q76 58 90 60" stroke="#ffe9a0" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.85" />
              <path d="M100 61 Q110 60 118 66" stroke="#ffe9a0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
            </g>

            {/* thick, determined eyebrows (drawn over the hair, anime style) */}
            <g className="brows">
              <path d="M58 83 L83 89" stroke="#a80f1a" strokeWidth="6" strokeLinecap="round" />
              <path d="M97 89 L122 83" stroke="#a80f1a" strokeWidth="6" strokeLinecap="round" />
            </g>
          </g>
        </g>
      </g>

      {/* listening waves near the ear */}
      <g className="listen-waves">
        <path d="M150 94 Q158 104 150 114" stroke="#ff7a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M158 88 Q170 104 158 120" stroke="#ff7a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}
