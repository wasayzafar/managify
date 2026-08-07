import React from 'react'
import { StoreInfo } from '../storage'
import { preloadImageAsBase64, getCachedImage } from './imageCache'

// Must match InvoiceHeaderDesigner constants
const CW = 794
const STORAGE_KEY = 'invoiceHeaderLayout'

// ── Minimal type mirrors (no import cycle) ────────────────────────────────────

type Crop = { x: number; y: number; w: number; h: number }

type HElem = {
  id: string; kind: 'logo' | 'text'
  x: number; y: number; w: number; h: number
  text?: string; fontSize?: number; bold?: boolean; italic?: boolean
  color?: string; align?: 'left' | 'center' | 'right'
  src?: string; crop?: Crop | null
}

type HeaderLayout = { elements: HElem[]; bgColor: string; borderColor: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

export function loadHeaderLayout(): HeaderLayout | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '') } catch { return null }
}

function CroppedImg({ src, crop }: { src: string; crop?: Crop | null }) {
  if (!crop || crop.w <= 0 || crop.h <= 0)
    return <img src={src} alt="" draggable={false}
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      onError={e => { e.currentTarget.style.display = 'none' }} />
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

// ── Custom layout header ──────────────────────────────────────────────────────
// Renders the saved designer layout scaled to `width` px.
// Uses absolute pixel values (not transforms) so html2canvas + printing work.

export function InvoiceHeaderPrint({ width = 640 }: { width?: number }) {
  const layout = loadHeaderLayout()
  if (!layout || !layout.elements.length) return null

  const scale = width / CW
  const contentH = layout.elements.reduce((m, e) => Math.max(m, e.y + e.h), 0)
  const height = Math.max(60, contentH * scale + 16)

  return (
    <div style={{
      position: 'relative', width, height,
      background: layout.bgColor || 'white',
      borderBottom: `2px solid ${layout.borderColor || '#333'}`,
      marginBottom: 24, overflow: 'hidden',
    }}>
      {layout.elements.map(el => (
        <div key={el.id} style={{
          position: 'absolute',
          left:   el.x * scale,
          top:    el.y * scale,
          width:  el.w * scale,
          height: el.h * scale,
          overflow: 'hidden',
          display: 'flex', alignItems: 'center',
          justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
        }}>
          {el.kind === 'logo' && el.src && <CroppedImg src={el.src} crop={el.crop} />}
          {el.kind === 'text' && (
            <span style={{
              width: '100%', display: 'block', overflow: 'hidden',
              color: el.color || '#111',
              fontSize: (el.fontSize || 14) * scale,
              fontWeight: el.bold ? 700 : 400,
              fontStyle: el.italic ? 'italic' : 'normal',
              textAlign: el.align || 'left',
              fontFamily: 'Arial, sans-serif',
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
            }}>{el.text}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Standard fallback header (when no designer layout is saved) ───────────────

export function FallbackHeader({ storeInfo }: { storeInfo: StoreInfo }) {
  return (
    <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24 }}>
      {storeInfo.logo && (
        <img src={storeInfo.logo} alt="" style={{ maxHeight: 60, maxWidth: 120, objectFit: 'contain', marginBottom: 8, display: 'block', margin: '0 auto 8px' }}
          onError={e => { e.currentTarget.style.display = 'none' }} />
      )}
      <h1 style={{ margin: 0, fontSize: 26, color: '#333' }}>{(storeInfo.storeName || 'MANAGIFY').toUpperCase()}</h1>
      {storeInfo.address   && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>{storeInfo.address}</p>}
      {storeInfo.phone     && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>Phone: {storeInfo.phone}</p>}
      {storeInfo.email     && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>Email: {storeInfo.email}</p>}
      {storeInfo.website   && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>{storeInfo.website}</p>}
      {storeInfo.taxNumber && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>Tax #: {storeInfo.taxNumber}</p>}
    </div>
  )
}

// ── Smart header: custom layout if saved, fallback otherwise ─────────────────

export function InvoiceHeader({ storeInfo, width = 640 }: { storeInfo: StoreInfo; width?: number }) {
  const layout = loadHeaderLayout()
  if (layout && layout.elements.length > 0) return <InvoiceHeaderPrint width={width} />
  return <FallbackHeader storeInfo={storeInfo} />
}

// ── Branding logo preloader ───────────────────────────────────────────────────

export async function preloadBrandingLogos() {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  await Promise.allSettled([
    preloadImageAsBase64(`${origin}/logo.png`),
    preloadImageAsBase64(`${origin}/nativeedge.png`),
  ])
}

// ── Invoice footer with branding ─────────────────────────────────────────────

export function InvoiceFooter({ storeInfo, thermal = false }: { storeInfo: StoreInfo; thermal?: boolean }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const managifyLogo  = getCachedImage(`${origin}/logo.png`)       || `${origin}/logo.png`
  const nativeedgeLogo = getCachedImage(`${origin}/nativeedge.png`) || `${origin}/nativeedge.png`

  if (thermal) {
    return (
      <div style={{ textAlign: 'center', marginTop: 8, borderTop: '1px dashed #000', paddingTop: 4, fontSize: 6 }}>
        <div style={{ fontWeight: 'bold' }}>Thank you for your business!</div>
        {storeInfo.phone && <div>Ph: {storeInfo.phone}</div>}
        {storeInfo.website && <div>{storeInfo.website}</div>}
        <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <img src={managifyLogo} alt="" style={{ height: 8, objectFit: 'contain', verticalAlign: 'middle' }}
            onError={e => { e.currentTarget.style.display = 'none' }} />
          <span style={{ fontWeight: 600 }}>managify.online</span>
        </div>
        <div style={{ fontSize: 5, color: '#666', marginTop: 1 }}>NativeEdge Studio · nativeedgestudio.space</div>
        <div style={{ fontSize: 5, color: '#888', marginTop: 2, borderTop: '1px dashed #ccc', paddingTop: 2 }}>
          Want this POS system for your business? Contact: nativeedge.studio@gmail.com | wa.me/923390149510
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 30, borderTop: '2px solid #eee', paddingTop: 20 }}>
      <div style={{ textAlign: 'center', fontSize: 13, color: '#555', marginBottom: 16 }}>
        <strong>Thank you for your business!</strong>
        {(storeInfo.phone || storeInfo.website) && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#777', display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            {storeInfo.phone   && <span>&#128222; {storeInfo.phone}</span>}
            {storeInfo.website && <span>&#127758; {storeInfo.website}</span>}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed #ddd', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={managifyLogo} alt="Managify" style={{ height: 24, width: 24, objectFit: 'contain', borderRadius: 5 }}
            onError={e => { e.currentTarget.style.display = 'none' }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#333', lineHeight: 1.3 }}>Managify</div>
            <div style={{ fontSize: 10, color: '#aaa' }}>managify.online</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={nativeedgeLogo} alt="NativeEdge" style={{ height: 20, width: 20, objectFit: 'contain', borderRadius: 4 }}
            onError={e => { e.currentTarget.style.display = 'none' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#666', lineHeight: 1.3 }}>NativeEdge Studio</div>
            <div style={{ fontSize: 10, color: '#aaa' }}>nativeedgestudio.space</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, textAlign: 'center', fontSize: 10, color: '#bbb', borderTop: '1px dashed #eee', paddingTop: 10 }}>
        Want this POS system for your business?&nbsp;
        <span style={{ color: '#888', fontWeight: 600 }}>Contact: nativeedge.studio@gmail.com &nbsp;|&nbsp; wa.me/923390149510</span>
      </div>
    </div>
  )
}

// ── Compact thermal header (plain text — no designer layout) ─────────────────

export function ThermalHeader({ storeInfo }: { storeInfo: StoreInfo }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 8 }}>
      {storeInfo.logo && (
        <img src={storeInfo.logo} alt="" style={{ maxHeight: 20, marginBottom: 3 }}
          onError={e => { e.currentTarget.style.display = 'none' }} />
      )}
      <div style={{ fontWeight: 'bold', fontSize: 10 }}>{(storeInfo.storeName || 'MANAGIFY').toUpperCase()}</div>
      {storeInfo.phone   && <div>Phone: {storeInfo.phone}</div>}
      {storeInfo.address && <div>{storeInfo.address}</div>}
      {storeInfo.email   && <div>{storeInfo.email}</div>}
    </div>
  )
}
