import { forwardRef, useId, type CSSProperties, type ReactNode } from 'react'
import fredokaFont from '@fontsource/fredoka/files/fredoka-latin-700-normal.woff2?inline'
import caveatFont from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?inline'
import { H, W, face } from './ticket'

// Celestial Night Sky & Pastel Cute theme: a 75% main ticket + 25% stub, same W x H as every other theme so the
// preview scaling and the PNG/WebP export work unchanged. The dark space canvas is the preview stage (.sky-stage in
// index.css), not part of this component, so the saved file stays transparent outside the ticket shape.

export interface CelestialTicketProps {
  title: string
  subtitle: string
  channelName: string
  /** YYYY-MM-DD, as produced by <input type="date"> */
  streamDate: string
  /** HH:mm, as produced by <input type="time"> */
  streamTime: string
  timezone: string
  characterImageUrl?: string
  /** One of SKIES[].id, falls back to the first sky. */
  backgroundTheme?: string
  characterZoom?: number
  characterX?: number
  characterY?: number
}

export const SKIES = [
  { id: 'sky', label: 'Sky', c1: '#bde9ff', c2: '#8fd0f7', warm: '#ffe8b5', deep: '#1c3f94', extrude: '#1f4fb8', title: ['#2f6df0', '#78c2ff', '#ffffff'] },
  { id: 'lavender', label: 'Lavender', c1: '#e6dcff', c2: '#b7c3ff', warm: '#ffd9e6', deep: '#3b2a8a', extrude: '#4b32b0', title: ['#7a4dff', '#b7a2ff', '#ffffff'] },
  { id: 'mint', label: 'Mint', c1: '#c9f6ea', c2: '#9fe3e6', warm: '#fff0bf', deep: '#0f5a5f', extrude: '#0b6f72', title: ['#0fa3a3', '#6fe0cf', '#ffffff'] },
]

export const CELESTIAL_FONT_CSS = [face('Fredoka', 700, fredokaFont), face('Caveat', 700, caveatFont)].join('')

export const loadCelestialFonts = () => Promise.all(['700 16px Fredoka', '700 16px Caveat'].map((f) => document.fonts.load(f, 'Aa')))

const BUBBLE = "'Fredoka', 'Zen Maru Gothic', sans-serif"
const SCRIPT = "'Caveat', cursive"
const SPLIT = 630 // main | stub boundary (75% / 25%)
const R = 14 // radius of the corner cuts and of the semicircular notches
const TEXT_W = 358

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Outline with concave corner cuts and top/bottom semicircular notches on the perforation. Everything clipped away
// stays transparent in the exported file.
const arc = (cx: number, cy: number, r: number, from: number, to: number) =>
  Array.from({ length: 11 }, (_, i) => {
    const a = ((from + ((to - from) * i) / 10) * Math.PI) / 180
    return `${(cx + r * Math.cos(a)).toFixed(2)}px ${(cy + r * Math.sin(a)).toFixed(2)}px`
  })

const OUTLINE = [
  ...arc(SPLIT, 0, R, 180, 0),
  ...arc(W, 0, R, 180, 90),
  ...arc(W, H, R, -90, -180),
  ...arc(SPLIT, H, R, 0, -180),
  ...arc(0, H, R, 0, -90),
  ...arc(0, 0, R, 90, 0),
].join(',')

function parseDate(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(y, mo - 1, d)
  if (dt.getMonth() !== mo - 1) return null
  return { day: DAYS[dt.getDay()], date: `${d} ${MONTHS[mo - 1]} ${y}` }
}

function breakTitle(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const whole = words.join(' ')
  if (words.length < 2 || whole.length <= 10) return [whole]
  let best: string[] = [whole]
  let bestMax = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const m = Math.max(a.length, b.length)
    if (m < bestMax) { bestMax = m; best = [a, b] }
  }
  return best
}

const STAR = 'M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.2L12 17.6l-6.3 3.8 1.7-7.2L2 9.5l7.1-.6z'
const SPARK = 'M12 1c1 6.5 4.5 10 11 11-6.5 1-10 4.5-11 11-1-6.5-4.5-10-11-11C7.5 11 11 7.5 12 1z'

function Paw({ size, color, opacity = 1, style }: { size: number; color: string; opacity?: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill={color} opacity={opacity} aria-hidden="true" style={style}>
      <ellipse cx="11" cy="30" rx="6.5" ry="8.5" transform="rotate(-22 11 30)" />
      <ellipse cx="24" cy="15" rx="6.5" ry="9" transform="rotate(-8 24 15)" />
      <ellipse cx="40" cy="15" rx="6.5" ry="9" transform="rotate(8 40 15)" />
      <ellipse cx="53" cy="30" rx="6.5" ry="8.5" transform="rotate(22 53 30)" />
      <path d="M32 30c-9 0-17 9-17 18 0 6 5 8.5 10 7.5 2.5-.5 4.5-1.8 7-1.8s4.5 1.3 7 1.8c5 1 10-1.5 10-7.5 0-9-8-18-17-18z" />
    </svg>
  )
}

function Star3D({ x, y, size, rot, face: f, shade }: { x: number; y: number; size: number; rot: number; face: string; shade: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="absolute" style={{ left: x, top: y, transform: `rotate(${rot}deg)`, overflow: 'visible' }} strokeLinejoin="round">
      <path d={STAR} fill={shade} stroke={shade} strokeWidth={3.6} transform="translate(0.5 1.4)" />
      <path d={STAR} fill="#fff" stroke="#fff" strokeWidth={3.6} />
      <path d={STAR} fill={f} stroke={f} strokeWidth={1.2} />
      <ellipse cx="9.4" cy="8.4" rx="1.7" ry="0.9" fill="#fff" opacity={0.85} transform="rotate(-35 9.4 8.4)" />
    </svg>
  )
}

function Plaster() {
  const dots = [9, 17, 25, 79, 87, 95]
  return (
    <svg viewBox="0 0 104 30" width={104} height={30} aria-hidden="true" className="absolute" style={{ left: SPLIT / 2 - 52 - 9, top: 0, transform: 'rotate(-3deg)' }}>
      <rect x="1" y="1" width="102" height="28" rx="9" fill="#ffd8c4" stroke="#f1b497" strokeWidth="1.5" />
      <rect x="33" y="1" width="38" height="28" fill="#ffeadd" stroke="#f1b497" strokeWidth="1.5" />
      {dots.flatMap((cx) => [8, 15, 22].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill="#f1b497" />))}
      {[44, 52, 60].flatMap((cx) => [10, 20].map((cy) => <circle key={`c${cx}-${cy}`} cx={cx} cy={cy} r="1" fill="#f6cbb4" />))}
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 28 20" width={22} height={16} aria-hidden="true" className="shrink-0">
      <rect width="28" height="20" rx="6" fill="#ff2b2b" />
      <path d="M11 5.5l8 4.5-8 4.5z" fill="#fff" />
    </svg>
  )
}

function BubbleTitle({ text, sky }: { text: string; sky: (typeof SKIES)[number] }) {
  const uid = useId().replace(/:/g, '')
  const lines = breakTitle(text)
  const longest = Math.max(...lines.map((l) => l.length), 1)
  const fs = Math.max(22, Math.min(lines.length > 1 ? 62 : 72, Math.floor((TEXT_W - 18) / (longest * 0.68))))
  const lh = Math.round(fs * 1.1)
  const h = lines.length * lh + 22
  const rows = (): ReactNode =>
    lines.map((line, i) => (
      <text key={i} x={TEXT_W / 2} y={10 + fs * 0.8 + i * lh} textAnchor="middle" fontFamily={BUBBLE} fontWeight={700} fontSize={fs} letterSpacing={1}>
        {line}
      </text>
    ))
  return (
    <svg width={TEXT_W} height={h} viewBox={`0 0 ${TEXT_W} ${h}`} role="img" aria-label={text} style={{ overflow: 'visible' }} strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <linearGradient id={`${uid}t`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={h}>
          <stop offset="0" stopColor={sky.title[0]} />
          <stop offset="0.55" stopColor={sky.title[1]} />
          <stop offset="1" stopColor={sky.title[2]} />
        </linearGradient>
      </defs>
      <g transform="translate(0 5)" fill={sky.extrude} stroke={sky.extrude} strokeWidth={16}>{rows()}</g>
      <g fill="#fff" stroke="#fff" strokeWidth={13}>{rows()}</g>
      <g fill={sky.title[0]} stroke={sky.title[0]} strokeWidth={3}>{rows()}</g>
      <g fill={`url(#${uid}t)`}>{rows()}</g>
    </svg>
  )
}

export const CelestialTicket = forwardRef<HTMLDivElement, CelestialTicketProps>((p, ref) => {
  const uid = useId().replace(/:/g, '')
  const s = SKIES.find((x) => x.id === p.backgroundTheme) ?? SKIES[0]
  const when = parseDate(p.streamDate)
  const time = /^\d{2}:\d{2}$/.test(p.streamTime) ? p.streamTime.replace(':', '.') : '--.--'
  const zoom = p.characterZoom ?? 1
  const x = p.characterX ?? 50
  const y = p.characterY ?? 50

  return (
    <div
      ref={ref}
      className="relative overflow-hidden whitespace-nowrap"
      style={{
        width: W,
        height: H,
        fontFamily: BUBBLE,
        color: s.deep,
        clipPath: `polygon(${OUTLINE})`,
        background: `radial-gradient(ellipse 65% 75% at 0% 100%, ${s.warm} 0%, ${s.warm}00 70%), linear-gradient(135deg, ${s.c1} 0%, ${s.c2} 100%)`,
      }}
    >
      {/* stub tint + watermark */}
      <div className="absolute" style={{ left: SPLIT, top: 0, width: W - SPLIT, height: H, background: 'rgba(255,255,255,0.22)' }} />
      <Paw size={128} color="#fff" opacity={0.32} style={{ position: 'absolute', left: 676, top: 101, transform: 'rotate(18deg)' }} />

      {/* double gradient frames, sparkles, perforation */}
      <svg width={W} height={H} className="absolute inset-0" aria-hidden="true" fill="none">
        <defs>
          <linearGradient id={`${uid}o`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id={`${uid}i`} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.warm} stopOpacity="0.95" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {[{ x: 9, w: 603 }, { x: 648, w: 183 }].map((f) => (
          <g key={f.x}>
            <rect x={f.x} y={9} width={f.w} height={312} rx={13} stroke={`url(#${uid}o)`} strokeWidth={2.5} />
            <rect x={f.x + 6} y={15} width={f.w - 12} height={300} rx={8} stroke={`url(#${uid}i)`} strokeWidth={1.5} />
          </g>
        ))}
        <line x1={SPLIT} y1={R + 8} x2={SPLIT} y2={H - R - 8} stroke="#fff" strokeOpacity={0.85} strokeWidth={2.5} strokeDasharray="5 7" strokeLinecap="round" />
        {[[372, 46, 0.5], [36, 172, 0.4], [812, 168, 0.45], [664, 60, 0.4]].map(([cx, cy, sc]) => (
          <path key={`${cx}-${cy}`} d={SPARK} fill="#fff" fillOpacity={0.9} transform={`translate(${cx - 12 * sc} ${cy - 12 * sc}) scale(${sc})`} />
        ))}
      </svg>

      <Plaster />
      <Star3D x={18} y={22} size={40} rot={-14} face="#ffe27a" shade="#f0b84a" />
      <Star3D x={16} y={278} size={30} rot={12} face="#ffb3d4" shade="#ef8db6" />
      <Star3D x={796} y={22} size={30} rot={14} face="#fff09a" shade="#f2c85c" />
      <Star3D x={788} y={282} size={34} rot={-10} face="#cdb8ff" shade="#a98af0" />

      {/* character window */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: 400,
          top: 24,
          width: 200,
          height: 282,
          borderRadius: 22,
          border: '3px solid rgba(255,255,255,0.9)',
          background: `radial-gradient(circle at 50% 85%, ${s.warm}cc 0%, transparent 65%), linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.12))`,
          boxShadow: 'inset 0 0 24px rgba(255,255,255,0.5)',
        }}
      >
        {p.characterImageUrl ? (
          <img src={p.characterImageUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${x}% ${y}%`, transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` }} />
        ) : (
          <div className="grid h-full place-items-center text-center text-[13px]" style={{ color: s.deep }}>
            <svg viewBox="0 0 100 150" width={110} height={165} aria-hidden="true" fill="#fff" fillOpacity={0.6} className="mx-auto">
              <circle cx="50" cy="50" r="22" />
              <path d="M10 150c0-30 18-52 40-52s40 22 40 52z" />
            </svg>
            <span className="-mt-8">YOUR CHARACTER</span>
          </div>
        )}
      </div>

      {/* main text */}
      <div className="absolute flex flex-col items-center justify-center gap-1" style={{ left: 34, top: 40, width: TEXT_W, height: 252 }}>
        {p.subtitle && (
          <div className="flex max-w-full items-center gap-1.5">
            <Paw size={18} color={s.deep} />
            <span className="min-w-0 truncate text-[25px] leading-[1.1]" style={{ fontFamily: SCRIPT }}>{p.subtitle}</span>
          </div>
        )}
        <BubbleTitle text={p.title} sky={s} />
        <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-[3px]" style={{ border: `2px solid ${s.deep}33`, boxShadow: `0 3px 0 ${s.deep}26` }}>
          <YouTubeIcon />
          <span className="min-w-0 truncate text-[15px]">{p.channelName || '@channel'}</span>
        </div>
      </div>

      {/* stub */}
      <div className="absolute flex flex-col items-center justify-center gap-2.5" style={{ left: 648, top: 0, width: 183, height: H }}>
        <span className="text-[26px] leading-none">{when?.day ?? '—'}</span>
        <span className="rounded-full px-4 py-[5px] text-[16px] leading-none text-white" style={{ background: s.deep }}>{when?.date ?? '—'}</span>
        <div className="flex flex-wrap items-baseline justify-center gap-x-1.5 leading-none">
          <span className="text-[38px]">{time}</span>
          <span className="text-[18px]">{p.timezone}</span>
        </div>
      </div>
    </div>
  )
})
