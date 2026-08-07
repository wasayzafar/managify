import React, { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { FiX, FiExternalLink, FiMessageSquare, FiMegaphone } from 'react-icons/fi'

type Ad = {
  id: string
  title: string
  content: string
  image_url: string
  link_url: string
  whatsapp_number: string
  bg_color: string
  text_color: string
  expires_at: string | null
}

export default function AdPopup() {
  const [ad, setAd] = useState<Ad | null>(null)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => { loadAd() }, [])

  async function loadAd() {
    try {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('announcements')
        .select('id,title,content,image_url,link_url,whatsapp_number,bg_color,text_color,expires_at')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!data || data.length === 0) return
      const picked = data[0]

      const lastSeen = localStorage.getItem(`ad_seen_${picked.id}`)
      if (lastSeen && Date.now() - Number(lastSeen) < 86_400_000) return

      setAd(picked)
      setVisible(true)
    } catch { /* silent */ }
  }

  function close() {
    setClosing(true)
    if (ad) localStorage.setItem(`ad_seen_${ad.id}`, String(Date.now()))
    setTimeout(() => { setVisible(false); setAd(null); setClosing(false) }, 280)
  }

  if (!visible || !ad) return null

  const hasButtons = !!(ad.link_url || ad.whatsapp_number)
  const waLink = ad.whatsapp_number
    ? `https://wa.me/${ad.whatsapp_number.replace(/\D/g, '')}`
    : ''

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        opacity: closing ? 0 : 1,
        transition: 'opacity 0.28s ease',
      }}
      onClick={close}
    >
      <div
        style={{
          position: 'relative',
          width: '100%', maxWidth: 440,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
          transform: closing ? 'scale(0.95) translateY(8px)' : 'scale(1) translateY(0)',
          transition: 'transform 0.28s cubic-bezier(.22,.68,0,1.2)',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Ad label bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'rgba(10,17,26,0.97)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            <FiMegaphone size={12} />
            Sponsored
          </div>

          <button
            onClick={close}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.14)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)' }}
          >
            <FiX size={14} />
          </button>
        </div>

        {/* Image — 1:1 */}
        {ad.image_url && (
          <div style={{ width: '100%', aspectRatio: '1 / 1', flexShrink: 0, background: '#060a10', overflow: 'hidden' }}>
            <img
              src={ad.image_url}
              alt={ad.title || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { e.currentTarget.parentElement!.style.display = 'none' }}
            />
          </div>
        )}

        {/* Text + buttons */}
        {(ad.title || ad.content || hasButtons) && (
          <div style={{
            background: ad.bg_color || '#0d1521',
            padding: hasButtons ? '18px 20px 20px' : '16px 20px',
            flexShrink: 0,
          }}>
            {ad.title && (
              <div style={{
                fontSize: 18, fontWeight: 700,
                color: ad.text_color || '#fff',
                marginBottom: ad.content ? 5 : 0,
                lineHeight: 1.3, letterSpacing: '-0.2px',
              }}>
                {ad.title}
              </div>
            )}
            {ad.content && (
              <div style={{
                fontSize: 13, lineHeight: 1.6,
                color: ad.text_color ? ad.text_color + 'bb' : 'rgba(255,255,255,0.65)',
                marginBottom: hasButtons ? 14 : 0,
              }}>
                {ad.content}
              </div>
            )}
            {hasButtons && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ad.link_url && (
                  <a
                    href={ad.link_url}
                    target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      flex: 1, minWidth: 110,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(34,99,255,0.85)',
                      color: '#fff', textDecoration: 'none',
                      fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                    }}
                  >
                    <FiExternalLink size={14} />
                    Visit Website
                  </a>
                )}
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      flex: 1, minWidth: 110,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(37,211,102,0.85)',
                      color: '#fff', textDecoration: 'none',
                      fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                    }}
                  >
                    <FiMessageSquare size={14} />
                    WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
