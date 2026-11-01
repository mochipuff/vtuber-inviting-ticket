import { useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { toCanvas } from 'html-to-image'
import { CELESTIAL_FONT_CSS, CelestialTicket, SKIES, loadCelestialFonts } from './celestial'
import { TzPicker } from './tzpicker'
import { FONT_CSS, H, Icon, KINDS, PALETTES, Ticket, W, loadFonts, toQrUrl, type PatternId, type ThemeId, type TicketData, type TicketKind } from './ticket'

type TextKey = 'title' | 'vtuber' | 'tagline' | 'invitedBy' | 'stamp' | 'date' | 'time' | 'tz' | 'place' | 'channel' | 'url' | 'qrLabel' | 'no'

const INITIAL: TicketData = {
  theme: 'pop',
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
  channel: '@yourchannel',
  url: 'https://youtube.com/@yourchannel',
  qrLabel: 'WAITING ROOM',
  no: '0001',
  paletteId: KINDS.debut.palette,
  sky: SKIES[0].id,
  pattern: 'dots',
  image: '',
  zoom: 1,
  posX: 50,
  posY: 50,
}

const PATTERNS: PatternId[] = ['dots', 'stripes', 'checker', 'none']
const THEMES: { id: ThemeId; label: string }[] = [{ id: 'pop', label: 'Pop collage' }, { id: 'celestial', label: 'Celestial night' }]
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

function Heading({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1f1630] text-sm text-white">{n}</span>
      {children}
    </h2>
  )
}

function Range(p: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="tag">{p.label} {p.value}</span>
      <input type="range" className="block w-full accent-[#7a2cff]" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} />
    </label>
  )
}

export default function App() {
  const [t, setT] = useState<TicketData>(INITIAL)
  const celestial = t.theme === 'celestial'
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
      await Promise.all([loadFonts(), loadCelestialFonts()])
      await go(1)
      await node.querySelector('img')?.decode().catch(() => undefined)
      await go(2)
      const canvas = await toCanvas(node, { pixelRatio: px, width: W, height: H, fontEmbedCSS: FONT_CSS + CELESTIAL_FONT_CSS })
      await go(3)
      const type = fmt === 'webp' ? 'image/webp' : 'image/png'
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.95))
      if (!blob) throw new Error('encode')
      await go(4)
      const ext = blob.type === type ? fmt : 'png'
      const slug = (celestial ? t.channel : t.vtuber).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ticket'
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
      <style>{FONT_CSS + CELESTIAL_FONT_CSS}</style>
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl sm:text-4xl">VTUBER INVITING TICKET</h1>
        <span className="rounded-full bg-[#fff3a8] px-3 py-0.5 text-sm font-bold">debut ✦ re:debut ✦ anniv ✦ bday</span>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 self-start lg:sticky lg:top-4">
          <div className="panel">
            <div className={`${celestial ? 'sky-stage' : 'checker'} rounded-xl p-3`}>
              <div ref={wrap} className="w-full overflow-hidden" style={{ height: H * scale }}>
                <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  {celestial ? (
                    <CelestialTicket
                      ref={ticketRef}
                      title={t.title}
                      subtitle={t.tagline}
                      channelName={t.channel}
                      streamDate={t.date}
                      streamTime={t.time}
                      timezone={t.tz}
                      characterImageUrl={t.image}
                      backgroundTheme={t.sky}
                      characterZoom={t.zoom}
                      characterX={t.posX}
                      characterY={t.posY}
                    />
                  ) : (
                    <Ticket ref={ticketRef} data={t} />
                  )}
                </div>
              </div>
            </div>
            <p className="mt-2 text-sm text-[#5b5075]">{celestial ? 'The dark sky is only the preview. Outside the ticket shape, the saved file is transparent.' : 'Checkerboard = transparent in the saved file.'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[1, 2, 3].map((n) => (
                <button key={n} className="btn" aria-pressed={px === n} disabled={!!job} onClick={() => setPx(n)}>{n}x</button>
              ))}
              <button className="btn bg-[#c8f4ff]" disabled={!!job} onClick={() => save('png')}>{job?.fmt === 'png' ? 'Saving…' : 'Save PNG'}</button>
              <button className="btn bg-[#fff3a8]" disabled={!!job} onClick={() => save('webp')}>{job?.fmt === 'webp' ? 'Saving…' : 'Save WebP'}</button>
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
                <div className="mb-1 flex justify-between text-sm font-bold">
                  <span>{STEPS[job.step]}…</span>
                  <span>{job.step + 1}/{STEPS.length}</span>
                </div>
                <div className="prog">
                  {STEPS.map((label, i) => (
                    <span key={label} className="prog-seg" data-state={i < job.step ? 'done' : i === job.step ? 'active' : 'todo'} />
                  ))}
                </div>
              </div>
            )}
            {note && <p role="status" className={`mt-2 text-sm font-bold ${note.ok ? 'text-[#0f5132]' : 'text-[#b4003f]'}`}>{note.text}</p>}
          </div>
        </section>

        <section className="min-w-0 space-y-6">
          <div className="panel">
            <Heading n={1}>What's the party?</Heading>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(KINDS) as TicketKind[]).map((k) => (
                <button key={k} className="btn" aria-pressed={t.kind === k} onClick={() => onKind(k)}><Icon id={KINDS[k].icon} /> {KINDS[k].label}</button>
              ))}
            </div>
          </div>

          <div className="panel space-y-3">
            <Heading n={2}>The details</Heading>
            <Field label="Event title"><input {...txt('title', 40)} /></Field>
            {!celestial && <Field label="VTuber name"><input {...txt('vtuber', 40)} /></Field>}
            <Field label={celestial ? 'Subtitle (handwriting text)' : 'Tagline'}><input {...txt('tagline', 60)} /></Field>
            {celestial ? (
              <Field label="Channel name"><input {...txt('channel', 40)} placeholder="@yourchannel" /></Field>
            ) : (
              <Field label="Invited by"><input {...txt('invitedBy', 40)} /></Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><input type="date" {...txt('date', 10)} /></Field>
              <Field label="Time"><input type="time" {...txt('time', 5)} /></Field>
            </div>
            <div>
              <span className="tag">Timezone</span>
              <TzPicker value={t.tz} onChange={(v) => set('tz', v)} />
            </div>
            {!celestial && (
              <>
                <Field label="Place"><input {...txt('place', 50)} /></Field>
                <Field label="Link → QR code"><input {...txt('url', 300)} placeholder="youtube.com/@you, maps.app.goo.gl/..." inputMode="url" /></Field>
                <p className="text-sm text-[#5b5075]">
                  {href ? `QR opens: ${href}` : t.url.trim() ? 'Not a valid http(s) link, so no QR yet.' : 'YouTube channel, waiting room, Google Maps, X profile... any link.'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="QR label"><input {...txt('qrLabel', 18)} /></Field>
                  <Field label="Stamp"><input {...txt('stamp', 14)} /></Field>
                </div>
                <Field label="Ticket no."><input {...txt('no', 6)} /></Field>
              </>
            )}
          </div>

          <div className="panel space-y-3">
            <Heading n={3}>The look</Heading>
            <div>
              <span className="tag">Theme</span>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((th) => (
                  <button key={th.id} className="btn" aria-pressed={t.theme === th.id} onClick={() => set('theme', th.id)}>{th.label}</button>
                ))}
              </div>
            </div>
            {celestial ? (
              <div>
                <span className="tag">Sky colors</span>
                <div className="flex flex-wrap gap-2">
                  {SKIES.map((sk) => (
                    <button key={sk.id} title={sk.label} aria-label={sk.label} aria-pressed={t.sky === sk.id} className="btn h-10 w-10" style={{ padding: 0, background: `linear-gradient(135deg, ${sk.c2} 50%, ${sk.warm} 50%)`, outline: t.sky === sk.id ? '3px solid #1f1630' : 'none', outlineOffset: 2 }} onClick={() => set('sky', sk.id)} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <span className="tag">Colors</span>
                  <div className="flex flex-wrap gap-2">
                    {PALETTES.map((pl) => (
                      <button key={pl.id} title={pl.id} aria-label={pl.id} className="btn h-10 w-10" style={{ padding: 0, background: `linear-gradient(135deg, ${pl.bg} 50%, ${pl.a} 50%)`, outline: t.paletteId === pl.id ? '3px solid #1f1630' : 'none', outlineOffset: 2 }} onClick={() => set('paletteId', pl.id)} />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="tag">Pattern</span>
                  <div className="flex flex-wrap gap-2">
                    {PATTERNS.map((pt) => (
                      <button key={pt} className="btn" aria-pressed={t.pattern === pt} onClick={() => set('pattern', pt)}>{pt}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <Field label={celestial ? 'Your character (transparent PNG works best, 8MB)' : 'Your art (PNG/JPG/WEBP/GIF, 8MB)'}>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="inp" onChange={(e) => onFile(e.target.files?.[0])} />
            </Field>
            {t.image && (
              <>
                <Range label="Zoom" value={t.zoom} min={1} max={3} step={0.05} onChange={(v) => set('zoom', v)} />
                <Range label="Focus X" value={t.posX} min={0} max={100} step={1} onChange={(v) => set('posX', v)} />
                <Range label="Focus Y" value={t.posY} min={0} max={100} step={1} onChange={(v) => set('posY', v)} />
                <button className="btn" onClick={() => set('image', '')}>Remove art</button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
