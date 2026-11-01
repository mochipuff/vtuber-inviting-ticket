import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

interface Zone { code: string; utc: string; place: string; region: string }

const ZONES: Zone[] = [
  { code: 'WIB', utc: 'UTC+7', place: 'Jakarta', region: 'Indonesia' },
  { code: 'WITA', utc: 'UTC+8', place: 'Makassar, Bali', region: 'Indonesia' },
  { code: 'WIT', utc: 'UTC+9', place: 'Jayapura', region: 'Indonesia' },
  { code: 'ICT', utc: 'UTC+7', place: 'Bangkok, Hanoi', region: 'Asia & Pacific' },
  { code: 'SGT', utc: 'UTC+8', place: 'Singapore', region: 'Asia & Pacific' },
  { code: 'MYT', utc: 'UTC+8', place: 'Kuala Lumpur', region: 'Asia & Pacific' },
  { code: 'PHT', utc: 'UTC+8', place: 'Manila', region: 'Asia & Pacific' },
  { code: 'JST', utc: 'UTC+9', place: 'Tokyo', region: 'Asia & Pacific' },
  { code: 'KST', utc: 'UTC+9', place: 'Seoul', region: 'Asia & Pacific' },
  { code: 'IST', utc: 'UTC+5:30', place: 'India', region: 'Asia & Pacific' },
  { code: 'AEST', utc: 'UTC+10', place: 'Sydney', region: 'Asia & Pacific' },
  { code: 'NZST', utc: 'UTC+12', place: 'Auckland', region: 'Asia & Pacific' },
  { code: 'UTC', utc: 'UTC+0', place: 'Universal time', region: 'Europe & Africa' },
  { code: 'GMT', utc: 'UTC+0', place: 'London (winter)', region: 'Europe & Africa' },
  { code: 'BST', utc: 'UTC+1', place: 'London (summer)', region: 'Europe & Africa' },
  { code: 'CET', utc: 'UTC+1', place: 'Paris, Berlin', region: 'Europe & Africa' },
  { code: 'CEST', utc: 'UTC+2', place: 'Paris, Berlin (summer)', region: 'Europe & Africa' },
  { code: 'EET', utc: 'UTC+2', place: 'Athens, Helsinki', region: 'Europe & Africa' },
  { code: 'BRT', utc: 'UTC-3', place: 'São Paulo', region: 'Americas' },
  { code: 'EST', utc: 'UTC-5', place: 'New York', region: 'Americas' },
  { code: 'EDT', utc: 'UTC-4', place: 'New York (summer)', region: 'Americas' },
  { code: 'CST', utc: 'UTC-6', place: 'Chicago', region: 'Americas' },
  { code: 'CDT', utc: 'UTC-5', place: 'Chicago (summer)', region: 'Americas' },
  { code: 'PST', utc: 'UTC-8', place: 'Los Angeles', region: 'Americas' },
  { code: 'PDT', utc: 'UTC-7', place: 'Los Angeles (summer)', region: 'Americas' },
]

const CUSTOM = ZONES.length // index of the extra "Custom..." option

export function TzPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const known = ZONES.find((z) => z.code === value)
  const [custom, setCustom] = useState(false)
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const showCustom = custom || (!known && value !== '')

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  useEffect(() => {
    if (custom) input.current?.focus()
  }, [custom])

  const openList = () => {
    const r = btn.current?.getBoundingClientRect()
    if (r) {
      const below = window.innerHeight - r.bottom
      setUp(below < 300 && r.top > below)
    }
    setActive(known ? ZONES.indexOf(known) : showCustom ? CUSTOM : 0)
    setOpen(true)
  }

  const choose = (i: number) => {
    setOpen(false)
    if (i === CUSTOM) {
      setCustom(true)
      return
    }
    setCustom(false)
    onChange(ZONES[i].code)
    btn.current?.focus()
  }

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList() }
      return
    }
    const last = CUSTOM
    if (e.key === 'ArrowDown') setActive((a) => Math.min(last, a + 1))
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(last)
    else if (e.key === 'Enter' || e.key === ' ') choose(active)
    else if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'Tab') { setOpen(false); return }
    else return
    e.preventDefault()
  }

  const option = (i: number, label: string, detail: string, selected: boolean) => (
    <li
      key={label}
      id={`${id}-o${i}`}
      role="option"
      aria-selected={selected}
      data-active={active === i}
      className="flex cursor-pointer items-center gap-3 px-3 py-2 data-[active=true]:bg-[#ece6fb]"
      onPointerDown={(e) => e.preventDefault()}
      onMouseEnter={() => setActive(i)}
      onClick={() => choose(i)}
    >
      <span className="w-12 shrink-0 font-black">{label}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-[#4a3d66]">{detail}</span>
      {selected && <span aria-hidden="true" className="font-black">✓</span>}
    </li>
  )

  return (
    <div ref={root} className="relative">
      <button
        ref={btn}
        type="button"
        role="combobox"
        aria-label="Timezone"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-o${active}` : undefined}
        className="inp flex cursor-pointer items-center justify-between gap-2 text-left"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
      >
        <span className="min-w-0 truncate">{showCustom ? 'Custom…' : known ? `${known.code} · ${known.utc} · ${known.place}` : 'Select a timezone'}</span>
        <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 9l7 7 7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute inset-x-0 z-20 rounded-2xl border-2 border-[#1f1630] bg-white shadow-[0_12px_32px_rgba(31,22,48,0.2)] ${up ? 'bottom-full mb-3' : 'top-full mt-3'}`}>
          <span aria-hidden="true" className={`absolute left-6 h-3.5 w-3.5 rotate-45 bg-white ${up ? '-bottom-[8px] border-b-2 border-r-2 border-[#1f1630]' : '-top-[8px] border-l-2 border-t-2 border-[#1f1630]'}`} />
          <ul ref={list} id={`${id}-list`} role="listbox" aria-label="Timezone" className="max-h-60 overflow-y-auto rounded-2xl py-1">
            {ZONES.map((z, i) => [
              i === 0 || ZONES[i - 1].region !== z.region ? (
                <li key={z.region} role="presentation" className="px-3 pb-1 pt-2 text-xs font-black uppercase tracking-wide text-[#5b5075]">{z.region}</li>
              ) : null,
              option(i, z.code, `${z.utc} · ${z.place}`, !showCustom && z.code === value),
            ])}
            <li role="presentation" className="mx-3 my-1 border-t-2 border-[#e4def2]" />
            {option(CUSTOM, 'Custom…', 'Type your own, e.g. UTC+5:30', showCustom)}
          </ul>
        </div>
      )}

      {showCustom && (
        <input ref={input} className="inp mt-2" maxLength={10} value={value} placeholder="e.g. UTC+5:30" aria-label="Custom timezone" onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}
