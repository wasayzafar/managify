import React, { useState, useRef, useEffect, useCallback } from 'react'
import { StoreInfo } from '../storage'
import {
	PiTextAaDuotone, PiTrashDuotone, PiCaretUpDuotone, PiCaretDownDuotone,
	PiArrowClockwiseDuotone, PiCropDuotone, PiTextItalicDuotone,
	PiTextAlignLeftDuotone, PiTextAlignCenterDuotone, PiTextAlignRightDuotone,
	PiFloppyDiskDuotone, PiPlusCircleDuotone, PiWarningDuotone, PiInfoDuotone,
	PiPaletteDuotone,
} from 'react-icons/pi'

// ── Constants ────────────────────────────────────────────────────────────────

const CW = 794   // logical canvas width (≈ A4 at 96dpi)
const CH = 320   // logical canvas height

// ── Types ────────────────────────────────────────────────────────────────────

type Crop   = { x: number; y: number; w: number; h: number }   // 0–1 fractions of natural image
type Align  = 'left' | 'center' | 'right'
type Handle = 'nw'|'n'|'ne'|'w'|'e'|'sw'|'s'|'se'

export type HElem = {
  id: string
  kind: 'logo' | 'text'
  x: number; y: number; w: number; h: number   // logical canvas px
  // text props
  text?: string; fontSize?: number; bold?: boolean; italic?: boolean
  color?: string; align?: Align
  // logo props
  src?: string; crop?: Crop | null
}

export type HeaderLayout = {
  elements: HElem[]
  bgColor: string
  borderColor: string
  // Standard field ids (name/addr/phone/email/web/tax/logo) the user has
  // deliberately removed — without this, mergeLayout() would treat "removed
  // on purpose" the same as "never placed" and silently re-add the element
  // the next time storeInfo is saved.
  removedIds?: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function defaultLayout(si: StoreInfo): HElem[] {
  const els: HElem[] = []
  let ty = 18
  const hasLogo = !!si.logo
  const tx = hasLogo ? 160 : 80
  const tw = hasLogo ? 600 : 634

  if (si.logo) els.push({ id: 'logo', kind: 'logo', x: 20, y: 20, w: 120, h: 100, src: si.logo, crop: null })

  const t = (id: string, text: string, fs: number, bold = false): HElem => {
    const el: HElem = { id, kind: 'text', x: tx, y: ty, w: tw, h: fs + 12, text, fontSize: fs, bold, italic: false, color: bold ? '#111111' : '#555555', align: hasLogo ? 'left' : 'center' }
    ty += fs + 16
    return el
  }
  if (si.storeName) els.push(t('name', si.storeName.toUpperCase(), 26, true))
  if (si.address)   els.push(t('addr', si.address, 13))
  if (si.phone)     els.push(t('phone', 'Phone: ' + si.phone, 13))
  if (si.email)     els.push(t('email', si.email, 13))
  if (si.website)   els.push(t('web', si.website, 12))
  if (si.taxNumber) els.push(t('tax', 'Tax #: ' + si.taxNumber, 12))
  return els
}

// Maps standard element IDs → their live storeInfo value, and a friendly label
const STANDARD_FIELDS: Record<string, { label: string; value: (si: StoreInfo) => string | undefined }> = {
  name:  { label: 'Store Name',  value: si => si.storeName  ? si.storeName.toUpperCase()   : undefined },
  addr:  { label: 'Address',     value: si => si.address    || undefined },
  phone: { label: 'Phone',       value: si => si.phone      ? 'Phone: ' + si.phone         : undefined },
  email: { label: 'Email',       value: si => si.email      || undefined },
  web:   { label: 'Website',     value: si => si.website    || undefined },
  tax:   { label: 'Tax Number',  value: si => si.taxNumber  ? 'Tax #: ' + si.taxNumber     : undefined },
}

// Merge a saved layout with the (last-saved) storeInfo:
//  • Updates text/src of standard elements to match the latest storeInfo
//  • Adds any elements that exist in storeInfo but are missing from the saved
//    layout — UNLESS the user deliberately removed them (removedIds)
//  • Removes standard elements whose storeInfo value is now empty
//  • Resets a logo's crop only when the logo's URL actually changed — a
//    stale crop fraction from a differently-sized old logo would otherwise
//    silently mis-frame the new one
function mergeLayout(saved: HeaderLayout, si: StoreInfo): HeaderLayout {
  const removed = new Set(saved.removedIds || [])

  // 1. Update existing standard elements
  let els = saved.elements.map(e => {
    if (e.kind === 'text' && STANDARD_FIELDS[e.id]) {
      const txt = STANDARD_FIELDS[e.id].value(si)
      return txt ? { ...e, text: txt } : null   // null = remove if field now empty
    }
    if (e.id === 'logo' && e.kind === 'logo') {
      if (!si.logo) return null
      return e.src === si.logo ? e : { ...e, src: si.logo, crop: null }
    }
    return e
  }).filter(Boolean) as HElem[]

  // 2. Find which standard elements are still missing (and not deliberately removed)
  const existingIds = new Set(els.map(e => e.id))
  const defaults = defaultLayout(si)
  const missing = defaults.filter(e => !existingIds.has(e.id) && !removed.has(e.id))

  // 3. Position missing elements below all current elements
  const bottomY = els.reduce((m, e) => Math.max(m, e.y + e.h), 0)
  let ty = bottomY + 12
  const placed = missing.map(e => { const el = { ...e, y: ty }; ty += e.h + 10; return el })

  return { ...saved, elements: [...els, ...placed] }
}

// ── Cropped Image (CSS background trick — no natural-dim needed) ─────────────
// background-position percentages are relative to (container size -
// background size), NOT to the crop rectangle directly, so the offset has to
// be crop.x / (1 - crop.w) — not crop.x / crop.w. Getting this wrong shows
// blank space instead of the cropped region for any crop that isn't anchored
// at the image's top-left corner.

function CroppedImg({ src, crop, w, h }: { src: string; crop?: Crop | null; w: number; h: number }) {
  if (!crop || crop.w <= 0 || crop.h <= 0)
    return <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }} />
  const posX = crop.w >= 1 ? 0 : (crop.x / (1 - crop.w)) * 100
  const posY = crop.h >= 1 ? 0 : (crop.y / (1 - crop.h)) * 100
  return (
    <div style={{
      width: '100%', height: '100%',
      backgroundImage: `url("${src}")`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${100 / crop.w}% ${100 / crop.h}%`,
      backgroundPosition: `${posX}% ${posY}%`,
    }} />
  )
}

// ── Crop Modal ───────────────────────────────────────────────────────────────

function CropModal({ src, initial, onApply, onClose }: {
  src: string; initial?: Crop | null
  onApply: (c: Crop | null) => void; onClose: () => void
}) {
  const imgRef    = useRef<HTMLImageElement>(null)
  const areaRef   = useRef<HTMLDivElement>(null)
  const [dw, setDw] = useState(0)
  const [dh, setDh] = useState(0)
  // crop in display-px
  const [crop, setCrop]     = useState({ x: 0, y: 0, w: 0, h: 0 })
  const [action, setAction] = useState<'idle'|'draw'|Handle|'move'>('idle')
  const anchor = useRef({ mx: 0, my: 0, cx: 0, cy: 0, cw: 0, ch: 0 })

  const onLoad = () => {
    const img = imgRef.current!
    const w = img.clientWidth, h = img.clientHeight
    setDw(w); setDh(h)
    if (initial && initial.w > 0 && initial.h > 0)
      setCrop({ x: initial.x * w, y: initial.y * h, w: initial.w * w, h: initial.h * h })
    else
      setCrop({ x: 0, y: 0, w, h })
  }

  const pos = (e: React.MouseEvent | MouseEvent) => {
    const r = areaRef.current!.getBoundingClientRect()
    return { px: clamp(e.clientX - r.left, 0, dw), py: clamp(e.clientY - r.top, 0, dh) }
  }

  const startDraw = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return
    const { px, py } = pos(e)
    anchor.current = { mx: px, my: py, cx: px, cy: py, cw: 0, ch: 0 }
    setCrop({ x: px, y: py, w: 0, h: 0 })
    setAction('draw')
  }
  const startHandle = (e: React.MouseEvent, h: string) => {
    e.stopPropagation()
    const { px, py } = pos(e)
    anchor.current = { mx: px, my: py, cx: crop.x, cy: crop.y, cw: crop.w, ch: crop.h }
    setAction(h as Handle | 'move')
  }

  useEffect(() => {
    if (action === 'idle') return
    const onMove = (e: MouseEvent) => {
      const { px, py } = pos(e)
      const dx = px - anchor.current.mx, dy = py - anchor.current.my
      const { cx, cy, cw, ch } = anchor.current
      if (action === 'draw') {
        setCrop({ x: Math.min(px, anchor.current.mx), y: Math.min(py, anchor.current.my), w: Math.abs(px - anchor.current.mx), h: Math.abs(py - anchor.current.my) })
        return
      }
      if (action === 'move') {
        setCrop({ x: clamp(cx + dx, 0, dw - cw), y: clamp(cy + dy, 0, dh - ch), w: cw, h: ch }); return
      }
      let nx = cx, ny = cy, nw = cw, nh = ch
      if ((action as string).includes('e')) nw = clamp(cw + dx, 10, dw - cx)
      if ((action as string).includes('s')) nh = clamp(ch + dy, 10, dh - cy)
      if ((action as string).includes('w')) { const x2 = clamp(cx + dx, 0, cx + cw - 10); nw = cw + cx - x2; nx = x2 }
      if ((action as string).includes('n')) { const y2 = clamp(cy + dy, 0, cy + ch - 10); nh = ch + cy - y2; ny = y2 }
      setCrop({ x: nx, y: ny, w: nw, h: nh })
    }
    const onUp = () => setAction('idle')
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [action, dw, dh])

  const apply = () => onApply(dw && dh && crop.w > 4 && crop.h > 4
    ? { x: crop.x / dw, y: crop.y / dh, w: crop.w / dw, h: crop.h / dh }
    : null)

  const hPos: Record<Handle, React.CSSProperties> = {
    nw: { top: -5, left: -5 }, n:  { top: -5, left: '50%', transform: 'translateX(-50%)' }, ne: { top: -5, right: -5 },
    w:  { top: '50%', left: -5, transform: 'translateY(-50%)' },                             e:  { top: '50%', right: -5, transform: 'translateY(-50%)' },
    sw: { bottom: -5, left: -5 }, s: { bottom: -5, left: '50%', transform: 'translateX(-50%)' }, se: { bottom: -5, right: -5 },
  }
  const hCursor: Record<Handle, string> = { nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', w: 'w-resize', e: 'e-resize', sw: 'sw-resize', s: 's-resize', se: 'se-resize' }
  const handles: Handle[] = ['nw','n','ne','w','e','sw','s','se']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PiCropDuotone size={18} /> Crop Logo
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onApply(null)} className="secondary" style={{ fontSize: 13, padding: '5px 14px' }}>Remove Crop</button>
            <button onClick={apply} style={{ fontSize: 13, padding: '5px 14px' }}>Apply</button>
            <button onClick={onClose} className="secondary" style={{ fontSize: 13, padding: '5px 14px' }}>Cancel</button>
          </div>
        </div>
        <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 12 }}>Drag on the image to select the area you want to keep</p>

        <div ref={areaRef} style={{ position: 'relative', display: 'inline-block', cursor: 'crosshair', userSelect: 'none' }}
          onMouseDown={startDraw}>
          <img ref={imgRef} src={src} alt="" onLoad={onLoad}
            style={{ display: 'block', maxWidth: 640, maxHeight: '62vh', objectFit: 'contain' }} draggable={false} />

          {dw > 0 && <>
            {/* Overlay: top / bottom / left / right of crop */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {[
                { left:0, top:0, width:dw, height: crop.y },
                { left:0, top: crop.y+crop.h, width:dw, height: dh-(crop.y+crop.h) },
                { left:0, top: crop.y, width: crop.x, height: crop.h },
                { left: crop.x+crop.w, top: crop.y, width: dw-(crop.x+crop.w), height: crop.h },
              ].map((s, i) => <div key={i} style={{ position:'absolute', background:'rgba(0,0,0,0.55)', ...s }} />)}
            </div>
            {/* Crop rect */}
            <div style={{
              position: 'absolute', left: crop.x, top: crop.y, width: crop.w, height: crop.h,
              border: '2px solid #3b82f6', boxSizing: 'border-box',
              cursor: action === 'move' ? 'grabbing' : 'move',
            }} onMouseDown={e => startHandle(e, 'move')}>
              {/* Grid lines */}
              {[1/3, 2/3].map(f => <>
                <div key={`v${f}`} style={{ position:'absolute', left:`${f*100}%`, top:0, bottom:0, width:1, background:'rgba(255,255,255,0.35)', pointerEvents:'none' }} />
                <div key={`h${f}`} style={{ position:'absolute', top:`${f*100}%`, left:0, right:0, height:1, background:'rgba(255,255,255,0.35)', pointerEvents:'none' }} />
              </>)}
              {handles.map(h => (
                <div key={h} data-handle={h} onMouseDown={e => startHandle(e, h)}
                  style={{ position:'absolute', width:10, height:10, background:'#3b82f6', border:'2px solid white', borderRadius:2, cursor: hCursor[h], ...hPos[h] }} />
              ))}
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}

// ── Main Designer ─────────────────────────────────────────────────────────────

const HANDLES: Handle[] = ['nw','n','ne','w','e','sw','s','se']
const CURSOR: Record<Handle, string> = { nw:'nw-resize', n:'n-resize', ne:'ne-resize', w:'w-resize', e:'e-resize', sw:'sw-resize', s:'s-resize', se:'se-resize' }
const HPOS: Record<Handle, React.CSSProperties> = {
  nw:{top:-5,left:-5}, n:{top:-5,left:'50%',transform:'translateX(-50%)'}, ne:{top:-5,right:-5},
  w:{top:'50%',left:-5,transform:'translateY(-50%)'}, e:{top:'50%',right:-5,transform:'translateY(-50%)'},
  sw:{bottom:-5,left:-5}, s:{bottom:-5,left:'50%',transform:'translateX(-50%)'}, se:{bottom:-5,right:-5},
}

const btnStyle = { fontSize: 13, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 } as const

export default function InvoiceHeaderDesigner({
  storeInfo,
  headerLayout,
  onSave,
}: {
  storeInfo: StoreInfo
  headerLayout?: string
  onSave: (json: string) => Promise<void>
}) {
  const initLayout = (): HeaderLayout => {
    try { if (headerLayout) return mergeLayout(JSON.parse(headerLayout), storeInfo) } catch {}
    return { elements: defaultLayout(storeInfo), bgColor: '#ffffff', borderColor: '#333333' }
  }

  const [layout, setLayout]   = useState<HeaderLayout>(initLayout)
  const [selected, setSelected] = useState<string | null>(null)
  const [cropElem, setCropElem] = useState<HElem | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savedMsg, setSavedMsg]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [scale, setScale]         = useState(1)
  const [confirmReset, setConfirmReset] = useState(false)
  const [addFieldOpen, setAddFieldOpen] = useState(false)

  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const resizing = useRef<{ id: string; handle: Handle; sx: number; sy: number; e0: HElem } | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)

  // Re-merge whenever storeInfo fields change. The caller is expected to
  // pass the last-SAVED storeInfo (not an in-progress edit draft) — merging
  // on every keystroke of an unsaved form would silently rewrite/lose header
  // elements as fields pass through empty intermediate states while typing.
  useEffect(() => {
    setLayout(prev => mergeLayout(prev, storeInfo))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeInfo.storeName, storeInfo.address, storeInfo.phone, storeInfo.email, storeInfo.website, storeInfo.taxNumber, storeInfo.logo])

  // Auto-scale to container width
  useEffect(() => {
    const update = () => {
      if (wrapRef.current) setScale(Math.min(1, (wrapRef.current.clientWidth - 4) / CW))
    }
    update()
    const ro = new ResizeObserver(update)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const elems = layout.elements
  const setElems = (fn: (es: HElem[]) => HElem[]) => setLayout(l => ({ ...l, elements: fn(l.elements) }))
  const updateElem = useCallback((id: string, patch: Partial<HElem>) =>
    setElems(es => es.map(e => e.id === id ? { ...e, ...patch } : e)), [])

  const toCanvas = useCallback((ex: number, ey: number) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { cx: (ex - r.left) / scale, cy: (ey - r.top) / scale }
  }, [scale])

  // Global mouse move / up
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        const { cx, cy } = toCanvas(e.clientX, e.clientY)
        const el = layout.elements.find(x => x.id === dragging.current!.id)
        if (!el) return
        updateElem(dragging.current.id, {
          x: clamp(cx - dragging.current.ox, 0, CW - el.w),
          y: clamp(cy - dragging.current.oy, 0, CH - el.h),
        })
      }
      if (resizing.current) {
        const { cx, cy } = toCanvas(e.clientX, e.clientY)
        const dx = cx - resizing.current.sx, dy = cy - resizing.current.sy
        const { e0, handle } = resizing.current
        let { x, y, w, h } = e0
        if (handle.includes('e')) w = clamp(w + dx, 20, CW - x)
        if (handle.includes('s')) h = clamp(h + dy, 10, CH - y)
        if (handle.includes('w')) { const nx = clamp(x + dx, 0, x + w - 20); w = w + x - nx; x = nx }
        if (handle.includes('n')) { const ny = clamp(y + dy, 0, y + h - 10); h = h + y - ny; y = ny }
        updateElem(resizing.current.id, { x, y, w, h })
      }
    }
    const onUp = () => { dragging.current = null; resizing.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [layout.elements, toCanvas, updateElem])

  const onElemDown = (e: React.MouseEvent, id: string) => {
    if (editingId) return
    e.stopPropagation(); e.preventDefault()
    const { cx, cy } = toCanvas(e.clientX, e.clientY)
    const el = elems.find(x => x.id === id)!
    setSelected(id)
    dragging.current = { id, ox: cx - el.x, oy: cy - el.y }
  }

  const onHandleDown = (e: React.MouseEvent, id: string, handle: Handle) => {
    e.stopPropagation(); e.preventDefault()
    const { cx, cy } = toCanvas(e.clientX, e.clientY)
    const el = elems.find(x => x.id === id)!
    resizing.current = { id, handle, sx: cx, sy: cy, e0: { ...el } }
  }

  const addText = () => {
    const id = uid()
    setElems(es => [...es, { id, kind: 'text', x: CW / 2 - 120, y: 20, w: 240, h: 32, text: 'New Text', fontSize: 16, bold: false, italic: false, color: '#111111', align: 'center' }])
    setSelected(id); setEditingId(id)
  }

  // Standard fields not currently on the canvas — either never placed, or
  // deliberately removed earlier. Selecting one from the dropdown re-adds it
  // (and un-marks it as removed, so it starts syncing with storeInfo again).
  const missingFields = Object.entries(STANDARD_FIELDS).filter(([id, f]) => {
    if (elems.some(e => e.id === id)) return false
    return f.value(storeInfo) !== undefined
  })
  const canAddLogo = !!storeInfo.logo && !elems.some(e => e.id === 'logo')

  const addField = (id: string) => {
    const bottomY = elems.reduce((m, e) => Math.max(m, e.y + e.h), 0)
    let newEl: HElem
    if (id === 'logo') {
      newEl = { id: 'logo', kind: 'logo', x: 20, y: bottomY + 12, w: 120, h: 100, src: storeInfo.logo, crop: null }
    } else {
      const f = STANDARD_FIELDS[id]
      const text = f.value(storeInfo)!
      newEl = { id, kind: 'text', x: 80, y: bottomY + 12, w: 634, h: 26, text, fontSize: id === 'name' ? 26 : 13, bold: id === 'name', italic: false, color: id === 'name' ? '#111111' : '#555555', align: 'center' }
    }
    setLayout(l => ({ ...l, elements: [...l.elements, newEl], removedIds: (l.removedIds || []).filter(x => x !== id) }))
    setSelected(newEl.id)
    setAddFieldOpen(false)
  }

  const deleteSelected = () => {
    if (!selected) return
    setLayout(l => ({
      ...l,
      elements: l.elements.filter(e => e.id !== selected),
      removedIds: (STANDARD_FIELDS[selected] || selected === 'logo')
        ? [...new Set([...(l.removedIds || []), selected])]
        : l.removedIds,
    }))
    setSelected(null)
  }

  const save = async () => {
    const json = JSON.stringify(layout)
    setSaving(true)
    try {
      await onSave(json)
      setSavedMsg('Saved!'); setTimeout(() => setSavedMsg(''), 3000)
    } catch {
      setSavedMsg('Save failed'); setTimeout(() => setSavedMsg(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => { setLayout({ elements: defaultLayout(storeInfo), bgColor: '#ffffff', borderColor: '#333333' }); setSelected(null); setConfirmReset(false) }

  const bringForward = () => {
    if (!selected) return
    setElems(es => { const i = es.findIndex(e => e.id === selected); if (i < es.length - 1) { const a = [...es]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a } return es })
  }
  const sendBackward = () => {
    if (!selected) return
    setElems(es => { const i = es.findIndex(e => e.id === selected); if (i > 0) { const a = [...es]; [a[i], a[i-1]] = [a[i-1], a[i]]; return a } return es })
  }

  const sel = elems.find(e => e.id === selected)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
        <PiInfoDuotone size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Reflects your last <strong>saved</strong> store information (Profile tab) — save changes there first, then design the header. This layout applies to A4/A5 printed invoices; thermal receipts (58mm/80mm) use a simplified text header.</span>
      </div>

      {/* ── Main toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <button onClick={addText} style={btnStyle}><PiTextAaDuotone size={15} /> Add Text</button>
        <div style={{ position: 'relative' }} onBlur={() => setTimeout(() => setAddFieldOpen(false), 150)} tabIndex={-1}>
          <button onClick={() => setAddFieldOpen(o => !o)} disabled={missingFields.length === 0 && !canAddLogo} className="secondary" style={btnStyle}>
            <PiPlusCircleDuotone size={15} /> Add Field
          </button>
          {addFieldOpen && (missingFields.length > 0 || canAddLogo) && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 160, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px var(--overlay)', zIndex: 100, overflow: 'hidden' }}>
              {canAddLogo && (
                <button onMouseDown={() => addField('logo')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>Logo</button>
              )}
              {missingFields.map(([id, f]) => (
                <button key={id} onMouseDown={() => addField(id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{f.label}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={deleteSelected} disabled={!selected} className="secondary" style={{ ...btnStyle, color: selected ? 'var(--danger)' : undefined }}><PiTrashDuotone size={15} /> Delete</button>
        <button onClick={bringForward} disabled={!selected} className="secondary" style={btnStyle}><PiCaretUpDuotone size={15} /> Forward</button>
        <button onClick={sendBackward} disabled={!selected} className="secondary" style={btnStyle}><PiCaretDownDuotone size={15} /> Backward</button>
        <span style={{ width: 1, height: 22, background: 'var(--border-strong)', margin: '0 2px', flexShrink: 0 }} />
        {/* Background color */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
          <PiPaletteDuotone size={15} /> BG
          <input type="color" value={layout.bgColor}
            onChange={e => setLayout(l => ({ ...l, bgColor: e.target.value }))}
            style={{ width: 28, height: 28, padding: 1, border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
        </label>
        {/* Border color */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
          Border
          <input type="color" value={layout.borderColor}
            onChange={e => setLayout(l => ({ ...l, borderColor: e.target.value }))}
            style={{ width: 28, height: 28, padding: 1, border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
        </label>
        <span style={{ width: 1, height: 22, background: 'var(--border-strong)', margin: '0 2px', flexShrink: 0 }} />
        <button onClick={() => setConfirmReset(true)} className="secondary" style={{ ...btnStyle, color: 'var(--danger)' }}><PiArrowClockwiseDuotone size={15} /> Reset to Default</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMsg && <span style={{ color: savedMsg === 'Save failed' ? 'var(--danger)' : 'var(--success)', fontSize: 13, fontWeight: 600 }}>{savedMsg}</span>}
          <button onClick={save} disabled={saving}
            style={{ padding: '7px 20px', background: 'var(--accent)', color: 'var(--accent-contrast)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.8 : 1, display: 'flex', alignItems: 'center', gap: 7 }}>
            <PiFloppyDiskDuotone size={16} /> {saving ? 'Saving...' : 'Save Layout'}
          </button>
        </div>
      </div>

      {/* ── Selected element contextual toolbar ── */}
      {sel && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          marginBottom: 10, padding: '8px 14px',
          background: 'color-mix(in srgb, var(--accent) 10%, var(--bg-elevated))', border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border))', borderRadius: 10,
        }}>
          {sel.kind === 'text' && <>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginRight: 2 }}>TEXT</span>
            {editingId !== sel.id
              ? <button style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setEditingId(sel.id)}>Edit Text</button>
              : <button style={{ fontSize: 12, padding: '3px 10px' }} className="secondary" onClick={() => setEditingId(null)}>Done</button>
            }
            <input type="number" min={8} max={96} value={sel.fontSize ?? 14}
              onChange={e => updateElem(sel.id, { fontSize: +e.target.value || 14 })}
              style={{ width: 52, padding: '3px 6px', fontSize: 12, background: 'var(--bg-sunken)', border: '1px solid var(--border-strong)', color: 'var(--text)', borderRadius: 6 }}
              title="Font size (px)" />
            <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>px</span>

            {/* Bold / Italic */}
            <button onClick={() => updateElem(sel.id, { bold: !sel.bold })}
              style={{ fontWeight: 700, fontSize: 13, padding: '3px 10px', background: sel.bold ? 'var(--accent)' : 'var(--bg-sunken)', color: sel.bold ? 'var(--accent-contrast)' : 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }}>
              B
            </button>
            <button onClick={() => updateElem(sel.id, { italic: !sel.italic })}
              style={{ display: 'flex', fontSize: 13, padding: '3px 10px', background: sel.italic ? 'var(--accent)' : 'var(--bg-sunken)', color: sel.italic ? 'var(--accent-contrast)' : 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }}>
              <PiTextItalicDuotone size={14} />
            </button>

            {/* Alignment */}
            {([
              ['left', <PiTextAlignLeftDuotone size={14} key="l" />],
              ['center', <PiTextAlignCenterDuotone size={14} key="c" />],
              ['right', <PiTextAlignRightDuotone size={14} key="r" />],
            ] as [Align, React.ReactNode][]).map(([a, icon]) => (
              <button key={a} onClick={() => updateElem(sel.id, { align: a })}
                style={{ display: 'flex', fontSize: 13, padding: '3px 9px', background: sel.align === a ? 'var(--accent)' : 'var(--bg-sunken)', color: sel.align === a ? 'var(--accent-contrast)' : 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }}
                title={`Align ${a}`}>
                {icon}
              </button>
            ))}

            {/* Color */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Color</span>
              <input type="color" value={sel.color ?? '#111111'}
                onChange={e => updateElem(sel.id, { color: e.target.value })}
                style={{ width: 28, height: 28, padding: 1, border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
            </label>
          </>}

          {sel.kind === 'logo' && <>
            <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 700, marginRight: 2 }}>LOGO</span>
            <button style={{ fontSize: 12, padding: '3px 12px', display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => setCropElem(sel)}><PiCropDuotone size={13} /> Crop</button>
            {sel.crop && (
              <button className="secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => updateElem(sel.id, { crop: null })}>Clear Crop</button>
            )}
          </>}

          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)' }}>
            x:{Math.round(sel.x)} y:{Math.round(sel.y)} · {Math.round(sel.w)}×{Math.round(sel.h)}
          </span>
        </div>
      )}

      {/* ── Canvas wrapper ── */}
      <div ref={wrapRef} style={{ width: '100%', overflow: 'hidden' }}>
        {/* Height = CH * scale so the page doesn't get a huge gap */}
        <div style={{ height: CH * scale + 2, position: 'relative' }}>
          <div
            ref={canvasRef}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: CW, height: CH,
              background: layout.bgColor,
              borderBottom: `3px solid ${layout.borderColor}`,
              boxShadow: '0 4px 24px var(--overlay)',
              outline: '1px solid var(--border-strong)',
              transformOrigin: 'top left',
              transform: `scale(${scale})`,
              userSelect: 'none',
            }}
            onClick={e => { if (e.target === canvasRef.current) { setSelected(null); setEditingId(null) } }}
          >
            {elems.map(el => {
              const isSel = selected === el.id
              return (
                <div
                  key={el.id}
                  style={{
                    position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
                    outline: isSel ? '2px solid #3b82f6' : '1px dashed rgba(120,140,180,0.25)',
                    outlineOffset: 1,
                    boxSizing: 'border-box',
                    cursor: dragging.current?.id === el.id ? 'grabbing' : 'grab',
                    overflow: el.kind === 'logo' ? 'hidden' : 'visible',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
                  }}
                  onMouseDown={e => onElemDown(e, el.id)}
                  onDoubleClick={() => el.kind === 'text' && setEditingId(el.id)}
                >
                  {el.kind === 'logo' && el.src && (
                    <CroppedImg src={el.src} crop={el.crop} w={el.w} h={el.h} />
                  )}
                  {el.kind === 'text' && (
                    editingId === el.id
                      ? (
                        <input
                          autoFocus
                          value={el.text ?? ''}
                          onChange={e => updateElem(el.id, { text: e.target.value })}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingId(null) }}
                          onClick={e => e.stopPropagation()}
                          style={{
                            width: '100%', height: '100%', padding: '0 4px', boxSizing: 'border-box',
                            background: 'rgba(59,130,246,0.08)', border: 'none', outline: '1.5px solid #3b82f6',
                            color: el.color ?? '#111', fontSize: el.fontSize ?? 14,
                            fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? 'italic' : 'normal',
                            textAlign: el.align ?? 'left', fontFamily: 'Arial, sans-serif',
                          }}
                        />
                      )
                      : (
                        <span style={{
                          width: '100%', display: 'block', padding: '0 4px', boxSizing: 'border-box',
                          color: el.color ?? '#111', fontSize: el.fontSize ?? 14,
                          fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? 'italic' : 'normal',
                          textAlign: el.align ?? 'left', fontFamily: 'Arial, sans-serif',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
                        }}>
                          {el.text}
                        </span>
                      )
                  )}

                  {/* Resize handles (only for selected) */}
                  {isSel && HANDLES.map(h => (
                    <div key={h} onMouseDown={e => onHandleDown(e, el.id, h)}
                      style={{ position: 'absolute', width: 9, height: 9, background: '#3b82f6', border: '2px solid white', borderRadius: 2, cursor: CURSOR[h], zIndex: 20, ...HPOS[h] }} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
        Drag to move · Double-click text to edit · Drag corners to resize · Click canvas background to deselect
      </p>

      {/* Crop modal */}
      {cropElem?.src && (
        <CropModal
          src={cropElem.src}
          initial={cropElem.crop}
          onApply={crop => { updateElem(cropElem.id, { crop }); setCropElem(null) }}
          onClose={() => setCropElem(null)}
        />
      )}

      {/* Reset confirmation */}
      {confirmReset && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }}
          onClick={() => setConfirmReset(false)}
        >
          <div className="card" style={{ maxWidth: 380, width: '100%', marginBottom: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', flexShrink: 0 }}>
                <PiWarningDuotone size={17} />
              </span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Reset to default layout?</h3>
            </div>
            <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
              This discards all custom positioning, text, colors, and crops on this canvas. It won't take effect on your invoices until you click Save Layout afterward.
            </p>
            <div className="form-actions">
              <button className="secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button onClick={reset} style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <PiArrowClockwiseDuotone size={15} /> Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
