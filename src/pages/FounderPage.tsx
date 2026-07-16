import React from 'react'
import { Link } from 'react-router-dom'
import { FiGithub, FiLinkedin, FiGlobe, FiCode, FiLayers, FiZap, FiTwitter } from 'react-icons/fi'

const skills = [
  'React', 'TypeScript', 'Node.js', 'Firebase',
  'Supabase', 'PostgreSQL', 'Vite', 'Tailwind CSS',
  'REST APIs', 'Git', 'UI/UX Design', 'System Architecture',
]

const projects = [
  {
    name: 'Managify',
    desc: 'Full-stack store management platform — inventory, billing, sales analytics, and profit tracking for modern retail.',
    url: '/welcome',
    icon: <FiLayers size={18} />,
  },
  {
    name: 'NativeEdge Studio',
    desc: 'Digital product studio focused on building fast, practical software for businesses across Pakistan and beyond.',
    url: 'https://nativeedgestudio.space',
    icon: <FiZap size={18} />,
    external: true,
  },
]

export default function FounderPage() {
  return (
    <>
      {/* SEO structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'Wasay Zafar',
        jobTitle: 'Founder & Software Developer',
        worksFor: { '@type': 'Organization', name: 'NativeEdge Studio', url: 'https://nativeedgestudio.space' },
        url: 'https://managify.online/founder',
        image: 'https://managify.online/me.jpg',
        sameAs: [
          'https://www.linkedin.com/in/wasay-zafar-50ba48213/',
          'https://github.com/wasayzafar',
          'https://x.com/wasaygfx',
        ],
        knowsAbout: skills,
        description: 'Software developer and founder of NativeEdge Studio, building practical digital products for businesses.',
      })}} />

      <div style={s.page}>
        {/* Minimal nav */}
        <nav style={s.nav}>
          <div style={s.navInner} className="pub-nav-inner">
            <Link to="/welcome" style={s.navBrand}>
              <img src="./logo.png" alt="Managify" width={28} style={{ borderRadius: 6 }} />
              <span style={s.navBrandName}>Managify</span>
            </Link>
            <Link to="/contact" style={s.navContact}>Get in Touch</Link>
          </div>
        </nav>

        {/* Hero */}
        <section style={s.hero}>
          <div style={s.heroBg} />
          <div style={s.heroInner} className="pub-founder-hero-inner">
            <div style={s.photoWrap}>
              <img src="./me.jpg" alt="Wasay Zafar" style={s.photo} />
              <div style={s.photoGlow} />
            </div>

            <div style={s.heroText}>
              <p style={s.eyebrow}>Founder &amp; Developer</p>
              <h1 style={s.name}>Wasay Zafar</h1>
              <p style={s.tagline}>
                Building software that helps businesses move faster — from retail management to custom digital products.
              </p>

              <div style={s.socialRow} className="pub-social-row">
                <a href="https://www.linkedin.com/in/wasay-zafar-50ba48213/" target="_blank" rel="noopener noreferrer" style={s.socialBtn}>
                  <FiLinkedin size={16} />
                  LinkedIn
                </a>
                <a href="https://github.com/wasayzafar" target="_blank" rel="noopener noreferrer" style={s.socialBtn}>
                  <FiGithub size={16} />
                  GitHub
                </a>
                <a href="https://x.com/wasaygfx" target="_blank" rel="noopener noreferrer" style={s.socialBtn}>
                  <FiTwitter size={16} />
                  X / Twitter
                </a>
                <a href="https://nativeedgestudio.space" target="_blank" rel="noopener noreferrer" style={{ ...s.socialBtn, ...s.socialBtnPrimary }}>
                  <FiGlobe size={16} />
                  NativeEdge Studio
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section style={s.section}>
          <div style={s.inner} className="pub-section-inner">
            <div style={s.twoCol} className="pub-two-col">
              {/* Bio */}
              <div>
                <h2 style={s.sectionTitle}>About</h2>
                <div style={s.bioCard}>
                  <p style={s.bioPara}>
                    I'm Wasay Zafar, a software developer and the founder of{' '}
                    <a href="https://nativeedgestudio.space" target="_blank" rel="noopener noreferrer" style={s.inlineLink}>NativeEdge Studio</a> — a digital product studio based in Karachi, Pakistan.
                  </p>
                  <p style={s.bioPara}>
                    I specialise in building full-stack web applications that solve real business problems. My focus is on clean architecture, fast performance, and interfaces that feel effortless to use.
                  </p>
                  <p style={s.bioPara}>
                    Managify is my flagship product — a complete store management system I designed and built from the ground up, used by retail businesses to manage inventory, billing, sales, and profitability in one place.
                  </p>
                  <p style={{ ...s.bioPara, marginBottom: 0 }}>
                    I'm available for freelance projects and product partnerships. If you have an idea that needs a strong technical foundation,{' '}
                    <Link to="/contact" style={s.inlineLink}>let's talk</Link>.
                  </p>
                </div>
              </div>

              {/* Skills */}
              <div>
                <h2 style={s.sectionTitle}>Skills</h2>
                <div style={s.skillsCard}>
                  <div style={s.skillGrid}>
                    {skills.map(sk => (
                      <div key={sk} style={s.skillPill}>
                        <FiCode size={11} style={{ opacity: 0.6 }} />
                        {sk}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Projects */}
        <section style={{ ...s.section, background: '#080d14' }}>
          <div style={s.inner} className="pub-section-inner">
            <h2 style={s.sectionTitle}>Projects</h2>
            <div style={s.projectGrid} className="pub-project-grid">
              {projects.map(p => (
                <a
                  key={p.name}
                  href={p.external ? p.url : undefined}
                  target={p.external ? '_blank' : undefined}
                  rel={p.external ? 'noopener noreferrer' : undefined}
                  onClick={!p.external ? () => window.location.href = p.url : undefined}
                  style={s.projectCard}
                >
                  <div style={s.projectIcon}>{p.icon}</div>
                  <h3 style={s.projectName}>{p.name}</h3>
                  <p style={s.projectDesc}>{p.desc}</p>
                  <span style={s.projectLink}>View project →</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={s.cta}>
          <div style={s.ctaGlow} />
          <div style={s.ctaInner}>
            <h2 style={s.ctaTitle}>Let's build something together</h2>
            <p style={s.ctaSub}>Have a project in mind? Reach out and let's discuss how I can help.</p>
            <Link to="/contact" style={s.ctaBtn}>Get in Touch</Link>
          </div>
        </section>

        {/* Footer */}
        <footer style={s.footer}>
          <div style={s.footerInner}>
            <span style={s.footerText}>Wasay Zafar · NativeEdge Studio</span>
            <span style={s.footerText}>&copy; {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    background: '#060a10',
    color: '#e8eef5',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    minHeight: '100vh',
  },

  nav: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    background: 'rgba(6,10,16,0.88)', backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  navInner: {
    maxWidth: 1000, margin: '0 auto', padding: '0 32px',
    height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  navBrand: { display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' },
  navBrandName: { fontSize: 16, fontWeight: 700, color: '#e8eef5' },
  navContact: {
    fontSize: 13, fontWeight: 600, color: '#e8eef5', textDecoration: 'none',
    background: '#1a2940', border: '1px solid #243245', borderRadius: 7, padding: '6px 16px',
  },

  hero: {
    position: 'relative', paddingTop: 120, paddingBottom: 72, overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 900px 500px at 50% 0%, rgba(34,99,255,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  heroInner: {
    position: 'relative', zIndex: 1,
    maxWidth: 1000, margin: '0 auto', padding: '0 32px',
    display: 'flex', alignItems: 'center', gap: 56, flexWrap: 'wrap' as const,
  },

  photoWrap: { position: 'relative', flexShrink: 0 },
  photo: {
    width: 180, height: 180, borderRadius: '50%',
    objectFit: 'cover', border: '3px solid #1a2940',
    position: 'relative', zIndex: 1,
    boxShadow: '0 0 0 6px rgba(34,99,255,0.1)',
  },
  photoGlow: {
    position: 'absolute', inset: -20, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(34,99,255,0.2) 0%, transparent 70%)',
    pointerEvents: 'none',
  },

  heroText: { flex: 1, minWidth: 280 },
  eyebrow: {
    fontSize: 12, fontWeight: 700, color: '#2263ff',
    textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 12,
  },
  name: {
    fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 800,
    letterSpacing: '-2px', color: '#e8eef5', margin: '0 0 16px 0',
  },
  tagline: {
    fontSize: 17, lineHeight: 1.7, color: '#8b949e', margin: '0 0 32px 0', maxWidth: 500,
  },
  socialRow: { display: 'flex', gap: 10, flexWrap: 'wrap' as const },
  socialBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: '#0d1521', border: '1px solid #1a2333',
    borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
    color: '#c9d5e0', textDecoration: 'none',
  },
  socialBtnPrimary: {
    background: 'rgba(34,99,255,0.12)', border: '1px solid rgba(34,99,255,0.3)', color: '#4d8fff',
  },

  section: { padding: '72px 0' },
  inner: { maxWidth: 1000, margin: '0 auto', padding: '0 32px' },
  twoCol: {
  },
  sectionTitle: {
    fontSize: 20, fontWeight: 700, color: '#e8eef5',
    margin: '0 0 20px 0', letterSpacing: '-0.5px',
  },

  bioCard: {
    background: '#0d1521', border: '1px solid #1a2333',
    borderRadius: 14, padding: '28px 24px',
  },
  bioPara: { fontSize: 15, lineHeight: 1.75, color: '#8b949e', margin: '0 0 16px 0' },
  inlineLink: { color: '#4d8fff', textDecoration: 'none', fontWeight: 600 },

  skillsCard: {
    background: '#0d1521', border: '1px solid #1a2333',
    borderRadius: 14, padding: '24px',
  },
  skillGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: 8 },
  skillPill: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#0a111a', border: '1px solid #1a2333',
    borderRadius: 99, padding: '5px 12px',
    fontSize: 12, fontWeight: 600, color: '#8b949e',
  },

  projectGrid: { marginTop: 8 },
  projectCard: {
    display: 'block', textDecoration: 'none',
    background: '#0d1521', border: '1px solid #1a2333',
    borderRadius: 14, padding: '28px 24px', cursor: 'pointer',
  },
  projectIcon: {
    width: 42, height: 42, borderRadius: 10,
    background: 'rgba(34,99,255,0.12)', border: '1px solid rgba(34,99,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#4d8fff', marginBottom: 16,
  },
  projectName: { fontSize: 17, fontWeight: 700, color: '#e8eef5', margin: '0 0 10px 0' },
  projectDesc: { fontSize: 14, color: '#6b7280', lineHeight: 1.65, margin: '0 0 16px 0' },
  projectLink: { fontSize: 13, color: '#4d8fff', fontWeight: 600 },

  cta: {
    position: 'relative', overflow: 'hidden',
    background: '#080d14', borderTop: '1px solid #1a2333',
    padding: '80px 32px', textAlign: 'center',
  },
  ctaGlow: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 700px 300px at 50% 50%, rgba(34,99,255,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  ctaInner: {
    position: 'relative', zIndex: 1, maxWidth: 520, margin: '0 auto',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  },
  ctaTitle: {
    fontSize: 32, fontWeight: 800, color: '#e8eef5',
    margin: 0, letterSpacing: '-1px',
  },
  ctaSub: { fontSize: 16, color: '#8b949e', margin: 0, lineHeight: 1.6 },
  ctaBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'linear-gradient(135deg, #2263ff 0%, #1a4fd4 100%)',
    color: 'white', textDecoration: 'none', borderRadius: 10,
    padding: '12px 28px', fontSize: 15, fontWeight: 600,
    boxShadow: '0 4px 24px rgba(34,99,255,0.3)', marginTop: 4,
  },

  footer: {
    background: '#060a10', borderTop: '1px solid #1a2333', padding: '24px 32px',
  },
  footerInner: {
    maxWidth: 1000, margin: '0 auto',
    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 8,
  },
  footerText: { fontSize: 13, color: '#374151' },
}
