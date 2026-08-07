import React, { useState, useRef, useEffect, useCallback } from 'react'
import { StoreInfo } from '../storage'

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

// Maps standard element IDs → their live storeInfo value
const FIELD_TEXT: Record<string, (si: StoreInfo) => string | undefined> = {
  name:  si => si.storeName  ? si.storeName.toUpperCase()   : undefined,
  addr:  si => si.address    || undefined,
  phone: si => si.phone      ? 'Phone: ' + si.phone         : undefined,
  email: si => si.email      || undefined,
  web:   si => si.website    || undefined,
  tax:   si => si.taxNumber  ? 'Tax #: ' + si.taxNumber     : undefined,
}

// Merge a saved layout with current storeInfo:
//  • Updates text/src of standard elements to match latest storeInfo
//  • Adds any elements that exist in storeInfo but are missing from the saved layout
//  • Removes standard elements whose storeInfo value is now empty
function mergeLayout(saved: HeaderLayout, si: StoreInfo): HeaderLayout {
  // 1. Update existing standard elements
  let els = saved.elements.map(e => {
    if (e.kind === 'text' && FIELD_TEXT[e.id]) {
      const txt = FIELD_TEXT[e.id](si)
      return txt ? { ...e, text: txt } : null   // null = remove if field now empty
    }
    if (e.id === 'logo' && e.kind === 'logo') {
      return si.logo ? { ...e, src: si.logo } : null
    }
    return e
  }).filter(Boolean) as HElem[]

  // 2. Find which standard elements are still missing
  const existingIds = new Set(els.map(e => e.id))
  const defaults = defaultLayout(si)
  const missing = defaults.filter(e => !existingIds.has(e.id))

  // 3. Position missing elements below all current elements
  const bottomY = els.reduce((m, e) => Math.max(m, e.y + e.h), 0)
  let ty = bottomY + 12
  const placed = missing.map(e => { const el = { ...e, y: ty }; ty += e.h + 10; return el })

  return { ...saved, elements: [...els, ...placed] }
}

// ── Cropped Image (CSS background trick — no natural-dim needed) ─────────────

function CroppedImg({ src, crop, w, h }: { src: string; crop?: Crop | null; w: number; h: number }) {
  if (!crop || crop.w <= 0 || crop.h <= 0)
    return <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }} />
  return (
    <div style={{
      width: '100%', height: '100%',
      backgroundImage: `url("${src}")`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${100 / crop.w}% ${100 / crop.h}%`,
      backgroundPosition: `${(-crop.x / crop.w) * 100}% ${(-crop.y / crop.h) * 100}%`,
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 14, padding: 24, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: '#e8eef5', fontSize: 18 }}>Crop Logo</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onApply(null)} className="secondary" style={{ fontSize: 13, padding: '5px 14px' }}>Remove Crop</button>
            <button onClick={apply} style={{ fontSize: 13, padding: '5px 14px' }}>Apply</button>
            <button onClick={onClose} className="secondary" style={{ fontSize: 13, padding: '5px 14px' }}>Cancel</button>
          </div>
        </div>
        <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 12 }}>Drag on the image to select the area you want to keep</p>

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

const STORAGE_KEY = 'invoiceHeaderLayout'

export function loadHeaderLayout(): HeaderLayout | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '') } catch { return null }
}

export default function InvoiceHeaderDesigner({
  storeInfo,
  headerLayout,
  onSave,
}: {
  storeInfo: StoreInfo
  headerLayout?: string
  onSave?: (json: string) => Promise<void>
}) {
  const initLayout = (): HeaderLayout => {
    // Priority: DB value → localStorage → default
    // Always merge with current storeInfo so new/changed fields appear automatically
    try { if (headerLayout) return mergeLayout(JSON.parse(headerLayout), storeInfo) } catch {}
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s) return mergeLayout(JSON.parse(s), storeInfo)
    } catch {}
    return { elements: defaultLayout(storeInfo), bgColor: '#ffffff', borderColor: '#333333' }
  }

  const [layout, setLayout]   = useState<HeaderLayout>(initLayout)
  const [selected, setSelected] = useState<string | null>(null)
  const [cropElem, setCropElem] = useState<HElem | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savedMsg, setSavedMsg]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [scale, setScale]         = useState(1)

  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const resizing = useRef<{ id: string; handle: Handle; sx: number; sy: number; e0: HElem } | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)

  // Re-merge whenever storeInfo fields change (user edits store info above and it propagates instantly)
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

  const deleteSelected = () => { if (!selected) return; setElems(es => es.filter(e => e.id !== selected)); setSelected(null) }

  const save = async () => {
    const json = JSON.stringify(layout)
    setSaving(true)
    try {
      if (onSave) await onSave(json)
      else localStorage.setItem(STORAGE_KEY, json)  // fallback when no DB callback
      setSavedMsg('Saved!'); setTimeout(() => setSavedMsg(''), 3000)
    } catch {
      setSavedMsg('Save failed'); setTimeout(() => setSavedMsg(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => { setLayout({ elements: defaultLayout(storeInfo), bgColor: '#ffffff', borderColor: '#333333' }); setSelected(null) }

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
      {/* ── Main toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <button onClick={addText} style={{ fontSize: 13, padding: '6px 14px' }}>+ Add Text</button>
        <button onClick={deleteSelected} disabled={!selected} className="secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Delete</button>
        <button onClick={bringForward} disabled={!selected} className="secondary" style={{ fontSize: 13, padding: '6px 14px' }}>↑ Forward</button>
        <button onClick={sendBackward} disabled={!selected} className="secondary" style={{ fontSize: 13, padding: '6px 14px' }}>↓ Backward</button>
        <span style={{ width: 1, height: 22, background: '#374151', margin: '0 2px', flexShrink: 0 }} />
        {/* Background color */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8' }}>
          BG
          <input type="color" value={layout.bgColor}
            onChange={e => setLayout(l => ({ ...l, bgColor: e.target.value }))}
            style={{ width: 28, height: 28, padding: 1, border: '1px solid #374151', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
        </label>
        {/* Border color */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8' }}>
          Border
          <input type="color" value={layout.borderColor}
            onChange={e => setLayout(l => ({ ...l, borderColor: e.target.value }))}
            style={{ width: 28, height: 28, padding: 1, border: '1px solid #374151', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
        </label>
        <span style={{ width: 1, height: 22, background: '#374151', margin: '0 2px', flexShrink: 0 }} />
        <button onClick={reset} className="secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Reset to Default</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMsg && <span style={{ color: savedMsg === 'Save failed' ? '#f87171' : '#4ade80', fontSize: 13, fontWeight: 600 }}>{savedMsg}</span>}
          <button onClick={save} disabled={saving}
            style={{ padding: '7px 20px', background: saving ? '#1a4bc4' : '#2263ff', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.8 : 1 }}>
            {saving ? 'Saving...' : 'Save Layout'}
          </button>
        </div>
      </div>

      {/* ── Selected element contextual toolbar ── */}
      {sel && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          marginBottom: 10, padding: '8px 14px',
          background: '#0d1526', border: '1px solid #1e3a5f', borderRadius: 10,
        }}>
          {sel.kind === 'text' && <>
            <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, marginRight: 2 }}>TEXT</span>
            {editingId !== sel.id
              ? <button style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setEditingId(sel.id)}>Edit Text</button>
              : <button style={{ fontSize: 12, padding: '3px 10px' }} className="secondary" onClick={() => setEditingId(null)}>Done</button>
            }
            <input type="number" min={8} max={96} value={sel.fontSize ?? 14}
              onChange={e => updateElem(sel.id, { fontSize: +e.target.value || 14 })}
              style={{ width: 52, padding: '3px 6px', fontSize: 12, background: '#1e293b', border: '1px solid #374151', color: '#e8eef5', borderRadius: 6 }}
              title="Font size (px)" />
            <span style={{ color: '#374151', fontSize: 11 }}>px</span>

            {/* Bold / Italic */}
            {([['bold', 'B', 'bold'], ['italic', 'I', 'italic']] as [keyof HElem, string, string][]).map(([k, label, style]) => (
              <button key={label} onClick={() => updateElem(sel.id, { [k]: !sel[k] })}
                style={{ fontWeight: 700, fontStyle: style === 'italic' ? 'italic' : 'normal', fontSize: 13, padding: '3px 10px', background: sel[k] ? '#2263ff' : '#1e293b', color: sel[k] ? 'white' : '#94a3b8', border: '1px solid #374151', borderRadius: 6, cursor: 'pointer' }}>
                {label}
              </button>
            ))}

            {/* Alignment */}
            {(['left', 'center', 'right'] as Align[]).map(a => (
              <button key={a} onClick={() => updateElem(sel.id, { align: a })}
                style={{ fontSize: 13, padding: '3px 9px', background: sel.align === a ? '#2263ff' : '#1e293b', color: sel.align === a ? 'white' : '#94a3b8', border: '1px solid #374151', borderRadius: 6, cursor: 'pointer' }}
                title={`Align ${a}`}>
                {a === 'left' ? '≡' : a === 'center' ? '☰' : '≡'}
                <span style={{ fontSize: 10, marginLeft: 2 }}>{a[0].toUpperCase()}</span>
              </button>
            ))}

            {/* Color */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Color</span>
              <input type="color" value={sel.color ?? '#111111'}
                onChange={e => updateElem(sel.id, { color: e.target.value })}
                style={{ width: 28, height: 28, padding: 1, border: '1px solid #374151', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
            </label>
          </>}

          {sel.kind === 'logo' && <>
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginRight: 2 }}>LOGO</span>
            <button style={{ fontSize: 12, padding: '3px 12px' }} onClick={() => setCropElem(sel)}>Crop</button>
            {sel.crop && (
              <button className="secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => updateElem(sel.id, { crop: null })}>Clear Crop</button>
            )}
          </>}

          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
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
              boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
              outline: '1px solid #374151',
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

      <p style={{ margin: '8px 0 0', color: '#4b5563', fontSize: 12 }}>
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
    </div>
  )
}
