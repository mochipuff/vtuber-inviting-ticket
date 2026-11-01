import { forwardRef, useMemo, type CSSProperties } from 'react'
import qrcode from 'qrcode-generator'

export type TicketKind = 'debut' | 'redebut' | 'anniversary' | 'birthday'
export type PatternId = 'dots' | 'stripes' | 'checker' | 'none'

export interface TicketData {
  kind: TicketKind
  title: string
  vtuber: string
  tagline: string
  invitedBy: string
  stamp: string
  date: string
  time: string
  tz: string
  place: string
  url: string
  qrLabel: string
  no: string
  paletteId: string
  pattern: PatternId
  image: string
  zoom: number
  posX: number
  posY: number
}

export const W = 840
export const H = 330
const K = '#111'

export const KINDS: Record<TicketKind, { label: string; title: string; stamp: string; palette: string; icon: string }> = {
  debut: { label: 'DEBUT', title: 'DEBUT STREAM', stamp: 'FIRST!!', palette: 'bubblegum', icon: '★' },
  redebut: { label: 'RE:DEBUT', title: 'RE:DEBUT LIVE', stamp: "I'M BACK", palette: 'acid', icon: '✦' },
  anniversary: { label: 'ANNIVERSARY', title: 'ANNIVERSARY LIVE', stamp: '1ST YEAR', palette: 'menhera', icon: '♛' },
  birthday: { label: 'BIRTHDAY', title: 'BIRTHDAY LIVE', stamp: 'HBD!!', palette: 'soda', icon: '♥' },
}

export const PALETTES = [
  { id: 'bubblegum', bg: '#ffc2e6', ink: '#1a0b2e', a: '#ff2d95', b: '#3df0ff' },
  { id: 'acid', bg: '#e4ff3d', ink: '#150c26', a: '#7a2cff', b: '#ff7ab8' },
  { id: 'menhera', bg: '#cdbdff', ink: '#1a0b2e', a: '#ff3d63', b: '#fff35c' },
  { id: 'soda', bg: '#a8ffd2', ink: '#10281f', a: '#ff6a2d', b: '#5b7cff' },
  { id: 'night', bg: '#241050', ink: '#fff4ff', a: '#ff2d95', b: '#3df0ff' },
]

/** Accepts only http(s) links so a QR can never carry javascript:/data: payloads. */
export function toQrUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s) && /^[a-z][a-z0-9+.-]*:/i.test(s)) return null
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null
    return u.href
  } catch {
    return null
  }
}

function fmtDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '—'
  const [y, m, d] = v.split('-').map(Number)
  const wd = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(y, m - 1, d).getDay()]
  return `${v.replace(/-/g, '.')} (${wd})`
}

function bars(seed: string) {
  let h = 7
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0
  const out: number[] = []
  for (let i = 0; i < 24; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    out.push(1 + (h % 4))
  }
  return out
}

function patternStyle(p: PatternId, c: string): CSSProperties {
  if (p === 'dots') return { backgroundImage: `radial-gradient(${c}55 2.2px, transparent 2.8px)`, backgroundSize: '16px 16px' }
  if (p === 'stripes') return { backgroundImage: `repeating-linear-gradient(-45deg, ${c}33 0 8px, transparent 8px 16px)` }
  if (p === 'checker') return { backgroundImage: `conic-gradient(${c}2e 25%, transparent 0 50%, ${c}2e 0 75%, transparent 0)`, backgroundSize: '36px 36px' }
  return {}
}

// Notched outline: the clipped-away areas stay transparent in the exported file.
const POLY =
  '14px 0,606px 0,620px 14px,634px 0,826px 0,840px 14px,840px 148px,824px 165px,840px 182px,840px 316px,826px 330px,634px 330px,620px 316px,606px 330px,14px 330px,0 316px,0 182px,16px 165px,0 148px,0 14px'

function Qr({ value }: { value: string }) {
  const qr = useMemo(() => {
    try {
      const q = qrcode(0, 'M')
      q.addData(value)
      q.make()
      const n = q.getModuleCount()
      let path = ''
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`
      return { n, path }
    } catch {
      return null
    }
  }, [value])
  if (!qr) return null
  return (
    <svg viewBox={`-2 -2 ${qr.n + 4} ${qr.n + 4}`} width="100%" height="100%" shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={qr.n + 4} height={qr.n + 4} fill="#fff" />
      <path d={qr.path} fill="#000" />
    </svg>
  )
}

export const Ticket = forwardRef<HTMLDivElement, { data: TicketData }>(({ data: d }, ref) => {
  const p = PALETTES.find((x) => x.id === d.paletteId) ?? PALETTES[0]
  const k = KINDS[d.kind]
  const href = toQrUrl(d.url)
  const tSize = Math.max(18, Math.min(40, Math.floor(340 / Math.max(d.title.length, 1))))
  const nSize = Math.max(14, Math.min(24, Math.floor(330 / Math.max(d.vtuber.length, 1))))

  const row = (label: string, value: string) => (
    <div className="flex items-center gap-2">
      <span className="w-[54px] shrink-0 text-center font-dot text-[11px]" style={{ background: p.b, border: `2px solid ${K}`, color: K }}>
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate px-2 text-[14px] font-black" style={{ background: '#fffdf5', border: `2px solid ${K}`, color: K }}>
        {value}
      </span>
    </div>
  )

  return (
    <div ref={ref} className="relative overflow-hidden font-body" style={{ width: W, height: H, background: p.bg, color: p.ink, clipPath: `polygon(${POLY})` }}>
      <div className="absolute inset-0" style={patternStyle(d.pattern, p.a)} />
      <div className="absolute opacity-60" style={{ left: 8, top: 8, width: 604, height: 314, border: `2px dashed ${p.ink}` }} />
      <div className="absolute opacity-60" style={{ left: 628, top: 8, width: 204, height: 314, border: `2px dashed ${p.ink}` }} />

      {/* art */}
      <div className="absolute overflow-hidden" style={{ left: 28, top: 38, width: 188, height: 254, border: `4px solid ${K}`, background: p.b, boxShadow: `6px 6px 0 ${K}`, transform: 'rotate(-3deg)' }}>
        {d.image ? (
          <img src={d.image} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${d.posX}% ${d.posY}%`, transform: `scale(${d.zoom})`, transformOrigin: `${d.posX}% ${d.posY}%` }} />
        ) : (
          <div className="grid h-full place-items-center text-center font-dot text-sm" style={{ color: K }}>
            YOUR<br />ART<br />HERE<br />♡
          </div>
        )}
      </div>
      <div className="absolute" style={{ left: 92, top: 24, width: 64, height: 22, background: `${p.b}cc`, border: `2px dashed ${K}`, transform: 'rotate(4deg)' }} />
      <div className="absolute grid place-items-center rounded-full text-center font-display leading-[1.05]" style={{ left: 150, top: 232, width: 88, height: 88, padding: 6, background: p.a, color: '#fff', border: `4px solid ${K}`, boxShadow: `3px 3px 0 ${K}`, transform: 'rotate(12deg)', fontSize: d.stamp.length > 8 ? 12 : 15 }}>
        {d.stamp}
      </div>

      {/* text */}
      <div className="absolute flex flex-col gap-[7px]" style={{ left: 244, top: 24, width: 356, height: 282 }}>
        <div className="flex items-center gap-2">
          <span className="px-2 font-dot text-[13px]" style={{ background: K, color: '#fff', transform: 'rotate(-2deg)' }}>{k.icon} {k.label}</span>
          <span className="font-dot text-[13px]">YOU'RE INVITED!!</span>
        </div>
        <div className="overflow-hidden break-words font-display leading-[1.05]" style={{ fontSize: tSize, maxHeight: tSize * 2.1, textShadow: `3px 3px 0 ${p.a}` }}>{d.title}</div>
        <div>
          <span className="inline-block max-w-full truncate font-display" style={{ fontSize: nSize, background: p.a, color: '#fff', border: `3px solid ${K}`, padding: '1px 10px', boxShadow: `4px 4px 0 ${K}`, transform: 'rotate(-1deg)' }}>{d.vtuber}</span>
        </div>
        {d.tagline && <div className="truncate text-[14px] font-black">{d.tagline}</div>}
        <div className="mt-1 flex flex-col gap-[5px]">
          {row('DATE', fmtDate(d.date))}
          {row('TIME', `${d.time || '--:--'} ${d.tz}`.trim())}
          {row('PLACE', d.place || '—')}
        </div>
        <div className="mt-auto truncate font-dot text-[14px]">INVITED BY ▸ <span className="underline decoration-2">{d.invitedBy || '???'}</span></div>
      </div>

      {/* stub */}
      <div className="absolute flex flex-col items-center gap-2" style={{ left: 636, top: 24, width: 188 }}>
        <div className="h-[150px] w-[150px] bg-white" style={{ border: `4px solid ${K}`, boxShadow: `5px 5px 0 ${p.a}`, transform: 'rotate(2deg)' }}>
          {href ? <Qr value={href} /> : <div className="grid h-full place-items-center text-center font-dot text-xs" style={{ color: K }}>ADD A LINK<br />→ QR</div>}
        </div>
        <span className="max-w-full truncate px-[6px] font-dot text-[12px]" style={{ background: p.b, border: `2px solid ${K}`, color: K }}>SCAN ▸ {d.qrLabel}</span>
        <div className="flex h-[30px] items-end">
          {bars(`${d.no}${d.vtuber}`).map((n, i) => (
            <span key={i} className="h-full" style={{ width: n * 2, marginRight: 2, background: p.ink }} />
          ))}
        </div>
        <span className="font-dot text-[12px] tracking-[2px]">NO. {d.no}</span>
        <span className="font-display text-[12px]">ADMIT ONE ♡</span>
      </div>
    </div>
  )
})
