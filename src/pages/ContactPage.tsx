import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import emailjs, { init } from '@emailjs/browser'
import {
  FiMapPin, FiPhone, FiMail, FiArrowRight,
  FiSend, FiCheckCircle, FiAlertCircle, FiMessageSquare
} from 'react-icons/fi'

const EJS_SERVICE  = import.meta.env.VITE_EMAILJS_SERVICE_ID  as string
const EJS_TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string
const EJS_KEY      = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string

init(EJS_KEY)

const contactDetails = [
  {
    icon: <FiMapPin size={20} />,
    label: 'Address',
    lines: ['Plot 6/3 Sheet No 21', 'Model Colony, Karachi', 'Pakistan'],
    href: 'https://maps.google.com/?q=Model+Colony+Karachi+Pakistan',
  },
  {
    icon: <FiPhone size={20} />,
    label: 'Phone',
    lines: ['+92 339 0149510'],
    href: 'tel:+923390149510',
  },
  {
    icon: <FiMessageSquare size={20} />,
    label: 'WhatsApp',
    lines: ['+92 339 0149510'],
    href: 'https://wa.me/923390149510',
  },
  {
    icon: <FiMail size={20} />,
    label: 'Email',
    lines: ['nativeedge.studio@gmail.com'],
    href: 'mailto:nativeedge.studio@gmail.com',
  },
]

export default function ContactPage() {
  const formRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    try {
      await emailjs.send(
        EJS_SERVICE,
        EJS_TEMPLATE,
        {
          from_name:  form.name,
          from_email: form.email,
          subject:    form.subject || 'Managify Enquiry',
          message:    form.message,
          reply_to:   form.email,
          to_name:    'NativeEdge Studio',
        }
      )
      setStatus('sent')
      setForm({ name: '', email: '', subject: '', message: '' })
      setTimeout(() => setStatus('idle'), 6000)
    } catch (err: any) {
      console.error('EmailJS error:', err?.text || err?.message || err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  return (
    <div style={s.page}>
      {/* ── NAV ── */}
      <nav style={s.nav}>
        <div style={s.navInner} className="pub-nav-inner">
          <Link to="/welcome" style={s.navBrand}>
            <img src="./logo.png" alt="Managify" width={30} style={{ borderRadius: 7 }} />
            <span style={s.navBrandName}>Managify</span>
          </Link>
          <div style={s.navLinks}>
            <Link to="/welcome" className="pub-nav-link" style={s.navLink}>Home</Link>
            <Link to="/login" className="pub-nav-login" style={s.navLogin}>Sign In</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={s.hero}>
        <div style={s.heroContent} className="pub-hero-content">
          <p style={s.eyebrow}>Get in touch</p>
          <h1 style={s.heroTitle}>Contact NativeEdge Studio</h1>
          <p style={s.heroSub}>
            Have a question about Managify or need a custom solution for your business?
            We'd love to hear from you.
          </p>
        </div>
      </section>

      {/* ── MAIN ── */}
      <section style={s.main}>
        <div style={s.mainInner} className="pub-contact-main">

          {/* Left — contact details */}
          <div style={s.detailsCol}>
            <div style={s.detailsCard}>
              <a href="https://nativeedgestudio.space" target="_blank" rel="noopener noreferrer" style={s.studioBrand}>
                <img src="./nativeedge.png" alt="NativeEdge Studio" width={38} style={{ borderRadius: 8 }} />
                <div>
                  <div style={s.studioName}>NativeEdge Studio</div>
                  <div style={s.studioTagline}>nativeedgestudio.space</div>
                </div>
              </a>

              <p style={s.detailsIntro}>
                We build digital products that help businesses grow. Managify is our flagship store management platform.
              </p>

              <div style={s.contactList}>
                {contactDetails.map(d => (
                  <a key={d.label} href={d.href}
                    target={d.label === 'Address' || d.label === 'WhatsApp' ? '_blank' : undefined}
                    rel="noopener noreferrer" className="pub-card" style={s.contactItem}>
                    <div style={{
                      ...s.contactIcon,
                      ...(d.label === 'WhatsApp' ? {
                        background: 'rgba(37,211,102,0.12)',
                        border: '1px solid rgba(37,211,102,0.25)',
                        color: '#25d366',
                      } : {}),
                    }}>{d.icon}</div>
                    <div>
                      <div style={s.contactLabel}>{d.label}</div>
                      {d.lines.map(line => (
                        <div key={line} style={s.contactValue}>{line}</div>
                      ))}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right — enquiry form */}
          <div style={s.formCol}>
            <div style={s.formCard}>
              <h2 style={s.formTitle}>Send us a message</h2>
              <p style={s.formSub}>We'll get back to you within one business day.</p>

              {status === 'sent' && (
                <div style={s.successBox}>
                  <FiCheckCircle size={16} />
                  <span>Message sent! We'll get back to you shortly.</span>
                </div>
              )}
              {status === 'error' && (
                <div style={s.errorBox}>
                  <FiAlertCircle size={16} />
                  <span>Failed to send. Please email us directly at nativeedge.studio@gmail.com</span>
                </div>
              )}

              <form ref={formRef} onSubmit={handleSubmit} style={s.form}>
                <div style={s.row} className="pub-form-row">
                  <div style={s.fieldGroup}>
                    <label style={s.label}>Your Name</label>
                    <input
                      style={s.input}
                      placeholder="John Smith"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div style={s.fieldGroup}>
                    <label style={s.label}>Email Address</label>
                    <input
                      type="email"
                      style={s.input}
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={s.fieldGroup}>
                  <label style={s.label}>Subject</label>
                  <input
                    style={s.input}
                    placeholder="Managify subscription / custom development…"
                    value={form.subject}
                    onChange={e => setForm({ ...form, subject: e.target.value })}
                  />
                </div>

                <div style={s.fieldGroup}>
                  <label style={s.label}>Message</label>
                  <textarea
                    style={{ ...s.input, ...s.textarea }}
                    placeholder="Tell us about your business and what you're looking for…"
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    required
                  />
                </div>

                <button type="submit" disabled={status === 'sending'} className="pub-contact-submit pub-cta-primary" style={{ ...s.submitBtn, opacity: status === 'sending' ? 0.7 : 1 }}>
                  <FiSend size={15} />
                  {status === 'sending' ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAP STRIP ── */}
      <section style={s.mapStrip} className="pub-map-strip">
        <div style={s.mapInner}>
          <FiMapPin size={16} style={{ color: '#2263ff', flexShrink: 0 }} />
          <span style={s.mapText}>
            Plot 6/3 Sheet No 21, Model Colony, Karachi, Pakistan
          </span>
          <a href="https://maps.google.com/?q=Model+Colony+Karachi+Pakistan"
            target="_blank" rel="noopener noreferrer" style={s.mapLink}>
            Open in Maps <FiArrowRight size={13} />
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={s.footer}>
        <div style={s.footerInner} className="pub-footer-inner">
          <div style={s.footerBrand}>
            <img src="./logo.png" alt="Managify" width={24} style={{ borderRadius: 6 }} />
            <span style={s.footerBrandName}>Managify</span>
          </div>
          <a href="https://nativeedgestudio.space" target="_blank" rel="noopener noreferrer" style={s.footerPowered}>
            <img src="./nativeedge.png" alt="NativeEdge Studio" width={16} style={{ borderRadius: 3, verticalAlign: 'middle' }} />
            {' '}Powered by <strong style={{ color: '#475569' }}>NativeEdge Studio</strong>
          </a>
          <Link to="/founder" className="pub-nav-link" style={s.founderBtn}>About the Founder</Link>
          <p style={s.footerCopy}>&copy; {new Date().getFullYear()} Managify. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    background: '#ffffff',
    color: '#0f172a',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    minHeight: '100vh',
  },

  nav: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    zIndex: 100,
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  navInner: {
    maxWidth: 1200, margin: '0 auto', padding: '0 32px',
    height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  navBrand: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
  navBrandName: { fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' },
  navLinks: { display: 'flex', alignItems: 'center', gap: 28 },
  navLink: { fontSize: 14, color: '#475569', textDecoration: 'none', fontWeight: 500 },
  navLogin: {
    fontSize: 14, fontWeight: 600, color: '#0f172a', textDecoration: 'none',
    background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 18px',
  },

  hero: {
    position: 'relative',
    paddingTop: 140,
    paddingBottom: 64,
  },
  heroContent: {
    position: 'relative', zIndex: 1,
    maxWidth: 700, margin: '0 auto', padding: '0 32px', textAlign: 'center',
  },
  eyebrow: {
    fontSize: 12, fontWeight: 700, color: '#2263ff',
    textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 14,
  },
  heroTitle: {
    fontSize: 'clamp(28px, 5vw, 52px)',
    fontWeight: 800, letterSpacing: '-1.5px',
    color: '#0f172a', margin: '0 0 20px 0',
  },
  heroSub: {
    fontSize: 17, lineHeight: 1.7, color: '#475569', margin: 0,
  },

  main: { padding: '64px 0 80px' },
  mainInner: {
    maxWidth: 1100, margin: '0 auto', padding: '0 32px',
  },

  detailsCol: {},
  detailsCard: {
    background: '#ffffff', border: '1px solid #e2e8f0',
    borderRadius: 12, padding: '32px 28px',
  },
  studioBrand: {
    display: 'flex', alignItems: 'center', gap: 14,
    textDecoration: 'none', marginBottom: 24,
  },
  studioName: { fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 3 },
  studioTagline: { fontSize: 12, color: '#2263ff' },
  detailsIntro: { fontSize: 14, color: '#475569', lineHeight: 1.7, margin: '0 0 28px 0' },

  contactList: { display: 'flex', flexDirection: 'column', gap: 6 },
  contactItem: {
    display: 'flex', alignItems: 'flex-start', gap: 16,
    textDecoration: 'none',
    background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: 10, padding: '16px 18px',
  },
  contactIcon: {
    width: 40, height: 40, borderRadius: 8,
    background: '#eff4ff', border: '1px solid #dbe6fe',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#2263ff', flexShrink: 0,
  },
  contactLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 },
  contactValue: { fontSize: 14, color: '#334155', fontWeight: 500, lineHeight: 1.5 },

  formCol: {},
  formCard: {
    background: '#ffffff', border: '1px solid #e2e8f0',
    borderRadius: 12, padding: '36px 32px',
  },
  formTitle: { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.5px' },
  formSub: { fontSize: 14, color: '#475569', margin: '0 0 28px 0' },

  successBox: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 13, color: '#16a34a', marginBottom: 20,
  },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 13, color: '#dc2626', marginBottom: 20,
  },

  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  row: {},
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 13, fontWeight: 600, color: '#475569', letterSpacing: '0.2px' },
  input: {
    width: '100%', background: '#f8fafc',
    border: '1px solid #cbd5e1', borderRadius: 8,
    color: '#0f172a', fontSize: 14,
    padding: '11px 14px', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  },
  textarea: { minHeight: 130, resize: 'vertical' as const },
  submitBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: '#2263ff',
    color: 'white', border: 'none', borderRadius: 8,
    padding: '13px 28px', fontSize: 15, fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-start' as const,
  },

  mapStrip: {
    background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
    padding: '18px 32px',
  },
  mapInner: {
    maxWidth: 1100, margin: '0 auto',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  mapText: { fontSize: 14, color: '#475569', flex: 1 },
  mapLink: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 13, color: '#2263ff', textDecoration: 'none', fontWeight: 600, flexShrink: 0,
  },

  footer: { background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '32px 32px' },
  footerInner: {
    maxWidth: 1100, margin: '0 auto',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
  },
  footerBrand: { display: 'flex', alignItems: 'center', gap: 8 },
  footerBrandName: { fontSize: 15, fontWeight: 700, color: '#0f172a' },
  footerPowered: { fontSize: 13, color: '#475569', margin: 0, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 },
  footerCopy: { fontSize: 13, color: '#475569', margin: 0 },
  founderBtn: {
    fontSize: 11, color: '#475569', textDecoration: 'none',
    border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '3px 9px', fontWeight: 500,
  },
}
