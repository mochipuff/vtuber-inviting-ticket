import { useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { toCanvas } from 'html-to-image'
import { FONT_CSS, H, Icon, KINDS, PALETTES, Ticket, W, loadFonts, toQrUrl, type PatternId, type TicketData, type TicketKind } from './ticket'

type TextKey = 'title' | 'vtuber' | 'tagline' | 'invitedBy' | 'stamp' | 'date' | 'time' | 'tz' | 'place' | 'url' | 'qrLabel' | 'no'

const INITIAL: TicketData = {
  kind: 'debut',
  title: KINDS.debut.title,
  vtuber: 'Your VTuber Name',
  tagline: 'Come say hi at my very first stream!',
  invitedBy: 'Your Name',
  stamp: KINDS.debut.stamp,
  date: '2026-12-24',
  time: '20:00',
  tz: 'JST',
  place: 'YouTube Waiting Room',
  url: 'https://youtube.com/@yourchannel',
  qrLabel: 'WAITING ROOM',
  no: '0001',
  paletteId: KINDS.debut.palette,
  pattern: 'dots',
  image: '',
  zoom: 1,
  posX: 50,
  posY: 50,
}

const PATTERNS: PatternId[] = ['dots', 'stripes', 'checker', 'none']
const MAX_IMG = 8 * 1024 * 1024
const STEPS = ['Loading fonts', 'Preparing art', 'Drawing ticket', 'Encoding file', 'Saving file'] as const

// Lets React paint the new step before the next heavy task blocks the main thread (timeout: hidden tabs pause rAF).
const nextPaint = () =>
  new Promise<void>((done) => {
    const t = setTimeout(done, 100)
    requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); done() }))
  })

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="tag">{label}</span>
      {children}
    </label>
  )
}

function Range(p: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="tag">{p.label} {p.value}</span>
      <input type="range" className="block w-full accent-[#ff2d95]" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} />
    </label>
  )
}

export default function App() {
  const [t, setT] = useState<TicketData>(INITIAL)
  const [px, setPx] = useState(2)
  const [job, setJob] = useState<{ fmt: 'png' | 'webp'; step: number } | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const running = useRef(false)
  const [scale, setScale] = useState(1)
  const wrap = useRef<HTMLDivElement>(null)
  const ticketRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / W)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const set = <K extends keyof TicketData>(k: K, v: TicketData[K]) => setT((p) => ({ ...p, [k]: v }))
  const txt = (k: TextKey, max: number) => ({
    className: 'inp',
    maxLength: max,
    value: t[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
  })

  const onKind = (kind: TicketKind) =>
    setT((p) => {
      const old = KINDS[p.kind]
      const nu = KINDS[kind]
      return {
        ...p,
        kind,
        title: p.title === old.title ? nu.title : p.title,
        stamp: p.stamp === old.stamp ? nu.stamp : p.stamp,
        paletteId: p.paletteId === old.palette ? nu.palette : p.paletteId,
      }
    })

  const onFile = (f?: File) => {
    if (!f) return
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type) || f.size > MAX_IMG) {
      setNote({ ok: false, text: 'Image must be PNG, JPG, WEBP or GIF, max 8 MB.' })
      return
    }
    const r = new FileReader()
    r.onload = () => set('image', String(r.result))
    r.readAsDataURL(f)
  }

  const save = async (fmt: 'png' | 'webp') => {
    const node = ticketRef.current
    if (!node || running.current) return
    running.current = true
    setNote(null)
    let step = 0
    const go = async (n: number) => {
      step = n
      setJob({ fmt, step: n })
      await nextPaint()
    }
    try {
      await go(0)
      await loadFonts()
      await go(1)
      await node.querySelector('img')?.decode().catch(() => undefined)
      await go(2)
      const canvas = await toCanvas(node, { pixelRatio: px, width: W, height: H, fontEmbedCSS: FONT_CSS })
      await go(3)
      const type = fmt === 'webp' ? 'image/webp' : 'image/png'
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.95))
      if (!blob) throw new Error('encode')
      await go(4)
      const ext = blob.type === type ? fmt : 'png'
      const slug = t.vtuber.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ticket'
      const name = `vtuber-ticket-${slug}.${ext}`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      const info = `${canvas.width}×${canvas.height}px, ${Math.max(1, Math.round(blob.size / 1024))} KB`
      setNote({ ok: true, text: ext !== fmt ? `This browser cannot encode WebP, so ${name} was saved as PNG (${info}).` : `Saved ${name} (${info}).` })
    } catch {
      setNote({ ok: false, text: `Export failed at "${STEPS[step]}". Try a smaller image or a lower scale.` })
    } finally {
      running.current = false
      setJob(null)
    }
  }

  const href = toQrUrl(t.url)

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">
      <style>{FONT_CSS}</style>
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl sm:text-5xl" style={{ textShadow: '4px 4px 0 #ff2d95' }}>VTUBER INVITING TICKET</h1>
        <span className="-rotate-3 border-[3px] border-[#1a0b2e] bg-[#fff35c] px-2 font-dot text-sm">debut ✦ re:debut ✦ anniv ✦ bday</span>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 self-start lg:sticky lg:top-4">
          <div className="panel">
            <div ref={wrap} className="checker w-full overflow-hidden" style={{ height: H * scale }}>
              <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <Ticket ref={ticketRef} data={t} />
              </div>
            </div>
            <p className="mt-2 font-dot text-xs">checkerboard = transparent in the saved file</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[1, 2, 3].map((n) => (
                <button key={n} className="btn" aria-pressed={px === n} disabled={!!job} onClick={() => setPx(n)}>{n}x</button>
              ))}
              <button className="btn bg-[#3df0ff]" disabled={!!job} onClick={() => save('png')}>{job?.fmt === 'png' ? 'SAVING...' : 'SAVE PNG'}</button>
              <button className="btn bg-[#fff35c]" disabled={!!job} onClick={() => save('webp')}>{job?.fmt === 'webp' ? 'SAVING...' : 'SAVE WEBP'}</button>
            </div>
            {job && (
              <div
                className="mt-3"
                role="progressbar"
                aria-label={`Saving ${job.fmt.toUpperCase()}`}
                aria-valuemin={0}
                aria-valuemax={STEPS.length}
                aria-valuenow={job.step}
                aria-valuetext={`Step ${job.step + 1} of ${STEPS.length}: ${STEPS[job.step]}`}
              >
                <div className="mb-1 flex justify-between font-dot text-xs">
                  <span>{STEPS[job.step]}...</span>
                  <span>{job.step + 1}/{STEPS.length}</span>
                </div>
                <div className="prog">
                  {STEPS.map((label, i) => (
                    <span key={label} className="prog-seg" data-state={i < job.step ? 'done' : i === job.step ? 'active' : 'todo'} />
                  ))}
                </div>
              </div>
            )}
            {note && <p role="status" className={`mt-2 text-sm font-black ${note.ok ? 'text-[#10281f]' : 'text-[#d6004f]'}`}>{note.text}</p>}
          </div>
        </section>

        <section className="min-w-0 space-y-6">
          <div className="panel">
            <h2 className="mb-3 font-display text-lg">1. WHAT'S THE PARTY?</h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(KINDS) as TicketKind[]).map((k) => (
                <button key={k} className="btn" aria-pressed={t.kind === k} onClick={() => onKind(k)}><Icon id={KINDS[k].icon} /> {KINDS[k].label}</button>
              ))}
            </div>
          </div>

          <div className="panel space-y-3">
            <h2 className="font-display text-lg">2. THE DETAILS</h2>
            <Field label="EVENT TITLE"><input {...txt('title', 40)} /></Field>
            <Field label="VTUBER NAME"><input {...txt('vtuber', 40)} /></Field>
            <Field label="TAGLINE"><input {...txt('tagline', 60)} /></Field>
            <Field label="INVITED BY"><input {...txt('invitedBy', 40)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="DATE"><input type="date" {...txt('date', 10)} /></Field>
              <Field label="TIME"><input type="time" {...txt('time', 5)} /></Field>
            </div>
            <Field label="TIMEZONE"><input {...txt('tz', 10)} placeholder="JST / UTC+7" /></Field>
            <Field label="PLACE"><input {...txt('place', 50)} /></Field>
            <Field label="LINK → QR CODE"><input {...txt('url', 300)} placeholder="youtube.com/@you, maps.app.goo.gl/..." inputMode="url" /></Field>
            <p className="text-xs font-bold">
              {href ? `QR opens: ${href}` : t.url.trim() ? 'Not a valid http(s) link, so no QR yet.' : 'YouTube channel, waiting room, Google Maps, X profile... any link.'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="QR LABEL"><input {...txt('qrLabel', 18)} /></Field>
              <Field label="STAMP"><input {...txt('stamp', 14)} /></Field>
            </div>
            <Field label="TICKET NO."><input {...txt('no', 6)} /></Field>
          </div>

          <div className="panel space-y-3">
            <h2 className="font-display text-lg">3. THE LOOK</h2>
            <div>
              <span className="tag">COLORS</span>
              <div className="flex flex-wrap gap-2">
                {PALETTES.map((pl) => (
                  <button key={pl.id} title={pl.id} aria-label={pl.id} className="btn h-10 w-10" style={{ padding: 0, background: `linear-gradient(135deg, ${pl.bg} 50%, ${pl.a} 50%)`, outline: t.paletteId === pl.id ? '3px solid #1a0b2e' : 'none', outlineOffset: 2 }} onClick={() => set('paletteId', pl.id)} />
                ))}
              </div>
            </div>
            <div>
              <span className="tag">PATTERN</span>
              <div className="flex flex-wrap gap-2">
                {PATTERNS.map((pt) => (
                  <button key={pt} className="btn" aria-pressed={t.pattern === pt} onClick={() => set('pattern', pt)}>{pt}</button>
                ))}
              </div>
            </div>
            <Field label="YOUR ART (PNG/JPG/WEBP/GIF, 8MB)">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="inp" onChange={(e) => onFile(e.target.files?.[0])} />
            </Field>
            {t.image && (
              <>
                <Range label="ZOOM" value={t.zoom} min={1} max={3} step={0.05} onChange={(v) => set('zoom', v)} />
                <Range label="FOCUS X" value={t.posX} min={0} max={100} step={1} onChange={(v) => set('posX', v)} />
                <Range label="FOCUS Y" value={t.posY} min={0} max={100} step={1} onChange={(v) => set('posY', v)} />
                <button className="btn" onClick={() => set('image', '')}>REMOVE ART</button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
