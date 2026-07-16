import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  FiPackage, FiFileText, FiTrendingUp, FiBarChart2,
  FiDollarSign, FiUsers, FiCreditCard, FiShoppingCart,
  FiCheckCircle, FiArrowRight, FiZap, FiShield, FiGlobe,
  FiPieChart, FiLayers, FiActivity
} from 'react-icons/fi'

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let start = 0
    const duration = 1800
    const step = 16
    const inc = to / (duration / step)
    const timer = setInterval(() => {
      start = Math.min(start + inc, to)
      if (ref.current) ref.current.textContent = Math.floor(start).toLocaleString() + suffix
      if (start >= to) clearInterval(timer)
    }, step)
    return () => clearInterval(timer)
  }, [to, suffix])
  return <span ref={ref}>0{suffix}</span>
}

// ── Data ──────────────────────────────────────────────────────────────────────
const features = [
  {
    icon: <FiPackage size={22} />,
    title: 'Smart Inventory',
    desc: 'Real-time stock levels, auto-deduct on sale, weighted average cost price, and low-stock alerts.',
  },
  {
    icon: <FiFileText size={22} />,
    title: 'Professional Billing',
    desc: 'Create thermal or A4 invoices in seconds. Item discounts, bill discounts, and PDF download built in.',
  },
  {
    icon: <FiTrendingUp size={22} />,
    title: 'Sales Analytics',
    desc: 'Track every bill, filter by date or item, spot return patterns, and download detailed PDF reports.',
  },
  {
    icon: <FiBarChart2 size={22} />,
    title: 'Profit & Loss',
    desc: 'Revenue minus cost minus expenses — see exactly where your money goes, broken down by period.',
  },
  {
    icon: <FiShoppingCart size={22} />,
    title: 'Purchase Management',
    desc: 'Log supplier purchases, track cost prices, generate bulk purchase PDFs, and export to Excel.',
  },
  {
    icon: <FiDollarSign size={22} />,
    title: 'Expense Tracking',
    desc: 'Categorise operating expenses, set recurring bills, and export monthly expense reports.',
  },
  {
    icon: <FiCreditCard size={22} />,
    title: 'Credits & Ledger',
    desc: 'Track customer credit balances, partial payments, and outstanding amounts in one place.',
  },
  {
    icon: <FiUsers size={22} />,
    title: 'Employee & HR',
    desc: 'Manage staff records, salaries, and attendance without leaving your store dashboard.',
  },
  {
    icon: <FiPieChart size={22} />,
    title: 'Asset Register',
    desc: 'Log business assets with purchase value, track depreciation, and maintain a clean balance.',
  },
]

const whyItems = [
  { icon: <FiZap size={18} />, title: 'Instant setup', desc: 'Live in minutes — no hardware, no IT team required.' },
  { icon: <FiShield size={18} />, title: 'Secure & private', desc: 'Firebase authentication with per-user data isolation.' },
  { icon: <FiGlobe size={18} />, title: 'Works anywhere', desc: 'Browser-based — desktop, tablet, or mobile.' },
  { icon: <FiLayers size={18} />, title: 'All-in-one', desc: 'Replace five separate tools with one coherent system.' },
  { icon: <FiActivity size={18} />, title: 'Real-time data', desc: 'Inventory and revenue update the moment a sale is made.' },
  { icon: <FiCheckCircle size={18} />, title: 'No lock-in', desc: 'Export everything to PDF or Excel at any time.' },
]

const stats = [
  { value: 12, suffix: '+', label: 'Modules' },
  { value: 100, suffix: '%', label: 'Browser-based' },
  { value: 50, suffix: '+', label: 'Report types' },
  { value: 1, suffix: ' click', label: 'Invoice printing' },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
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
            <div className="pub-nav-feature-links">
              <a href="#features" style={s.navLink}>Features</a>
              <a href="#why" style={s.navLink}>Why Managify</a>
              <Link to="/contact" style={s.navLink}>Contact</Link>
            </div>
            <Link to="/login" style={s.navLogin}>Sign In</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={s.hero}>
        <div style={s.heroBg} />
        <div style={s.heroContent} className="pub-hero-content">
          <div style={s.badge}>
            <FiZap size={12} />
            <span>Store Management, Reimagined</span>
          </div>
          <h1 style={s.heroH1}>
            The complete platform<br />
            for <span style={s.heroAccent}>modern retail</span>
          </h1>
          <p style={s.heroSub}>
            Inventory, billing, sales analytics, and profit tracking — unified in one
            fast, browser-based system built for store owners who mean business.
          </p>
          <div style={s.heroCtas}>
            <Link to="/login" style={s.ctaPrimary}>
              Get Started
              <FiArrowRight size={16} />
            </Link>
            <a href="#features" style={s.ctaSecondary}>
              Explore Features
            </a>
          </div>

          {/* Hero preview card */}
          <div style={s.heroCard}>
            <div style={s.heroCardHeader}>
              <span style={s.heroCardDot} />
              <span style={{ ...s.heroCardDot, background: '#f59e0b' }} />
              <span style={{ ...s.heroCardDot, background: '#22c55e' }} />
              <span style={s.heroCardTitle}>Sales Dashboard</span>
            </div>
            <div style={s.heroCardBody} className="pub-hero-card-body">
              {[
                { label: 'Revenue Today', value: 'PKR 84,200', color: '#4ade80', change: '+12%' },
                { label: 'Bills Created', value: '23', color: '#60a5fa', change: '+4' },
                { label: 'Items Sold', value: '147', color: '#a78bfa', change: '+18' },
                { label: 'Net Profit', value: 'PKR 31,500', color: '#34d399', change: '+8%' },
              ].map(stat => (
                <div key={stat.label} style={s.heroStatCard}>
                  <div style={s.heroStatLabel}>{stat.label}</div>
                  <div style={{ ...s.heroStatValue, color: stat.color }}>{stat.value}</div>
                  <div style={s.heroStatChange}>{stat.change}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section style={s.statsStrip} className="pub-stats-strip">
        {stats.map(st => (
          <div key={st.label} style={s.statItem}>
            <div style={s.statValue}>
              <Counter to={st.value} suffix={st.suffix} />
            </div>
            <div style={s.statLabel}>{st.label}</div>
          </div>
        ))}
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={s.section} className="pub-section">
        <div style={s.sectionInner} className="pub-section-inner">
          <div style={s.sectionHead}>
            <p style={s.sectionEyebrow}>Everything you need</p>
            <h2 style={s.sectionTitle}>Nine modules. One dashboard.</h2>
            <p style={s.sectionDesc}>
              Every tool a store owner needs — tightly integrated so data flows automatically between billing, inventory, and reports.
            </p>
          </div>
          <div style={s.featureGrid} className="pub-feature-grid">
            {features.map(f => (
              <div key={f.title} style={s.featureCard}>
                <div style={s.featureIconWrap}>{f.icon}</div>
                <h3 style={s.featureTitle}>{f.title}</h3>
                <p style={s.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY ── */}
      <section id="why" style={{ ...s.section, background: '#080d14' }} className="pub-section">
        <div style={s.sectionInner} className="pub-section-inner">
          <div style={s.sectionHead}>
            <p style={s.sectionEyebrow}>Why Managify</p>
            <h2 style={s.sectionTitle}>Built for the way stores actually work</h2>
          </div>
          <div style={s.whyGrid} className="pub-why-grid">
            {whyItems.map(w => (
              <div key={w.title} style={s.whyCard}>
                <div style={s.whyIconWrap}>{w.icon}</div>
                <div>
                  <div style={s.whyTitle}>{w.title}</div>
                  <div style={s.whyDesc}>{w.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={s.ctaBanner} className="pub-cta-banner">
        <div style={s.ctaBannerGlow} />
        <div style={s.ctaBannerInner}>
          <h2 style={s.ctaBannerTitle}>Ready to take control of your store?</h2>
          <p style={s.ctaBannerSub}>
            Sign in and start managing inventory, billing, and profits from day one.
          </p>
          <Link to="/login" style={s.ctaPrimary}>
            Open Dashboard
            <FiArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={s.footer}>
        <div style={s.footerInner} className="pub-footer-inner">
          <div style={s.footerBrand}>
            <img src="./logo.png" alt="Managify" width={26} style={{ borderRadius: 6 }} />
            <span style={s.footerBrandName}>Managify</span>
          </div>
          <a href="https://nativeedgestudio.space" target="_blank" rel="noopener noreferrer" style={s.footerPowered}>
            <img src="./nativeedge.png" alt="NativeEdge Studio" width={18} style={{ borderRadius: 4, verticalAlign: 'middle' }} />
            {' '}Powered by <strong style={{ color: '#8b949e' }}>NativeEdge Studio</strong>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' as const }}>
            <Link to="/contact" style={{ fontSize: 13, color: '#4a5568', textDecoration: 'none' }}>Contact</Link>
            <p style={s.footerCopy}>&copy; {new Date().getFullYear()} Managify. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: {
    background: '#060a10',
    color: '#e8eef5',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    minHeight: '100vh',
    overflowX: 'hidden',
  },

  // Nav
  nav: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    zIndex: 100,
    background: 'rgba(6,10,16,0.85)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  navInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 32px',
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
  },
  navBrandName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#e8eef5',
    letterSpacing: '-0.3px',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 32,
  },
  navLink: {
    fontSize: 14,
    color: '#8b949e',
    textDecoration: 'none',
    fontWeight: 500,
    transition: 'color 0.2s',
  },
  navLogin: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e8eef5',
    textDecoration: 'none',
    background: '#1a2940',
    border: '1px solid #243245',
    borderRadius: 8,
    padding: '7px 18px',
  },

  // Hero
  hero: {
    position: 'relative',
    paddingTop: 130,
    paddingBottom: 80,
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    inset: 0,
    background: `
      radial-gradient(ellipse 800px 600px at 60% 10%, rgba(34,99,255,0.12) 0%, transparent 70%),
      radial-gradient(ellipse 600px 400px at 10% 80%, rgba(34,99,255,0.07) 0%, transparent 70%)
    `,
    pointerEvents: 'none',
  },
  heroContent: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '0 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    background: 'rgba(34,99,255,0.12)',
    border: '1px solid rgba(34,99,255,0.3)',
    borderRadius: 99,
    padding: '5px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: '#4d8fff',
    letterSpacing: '0.5px',
    marginBottom: 28,
    textTransform: 'uppercase',
  },
  heroH1: {
    fontSize: 'clamp(36px, 6vw, 68px)',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-2px',
    color: '#e8eef5',
    margin: '0 0 24px 0',
  },
  heroAccent: {
    background: 'linear-gradient(90deg, #2263ff, #60a5fa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSub: {
    fontSize: 18,
    lineHeight: 1.7,
    color: '#8b949e',
    maxWidth: 600,
    margin: '0 0 40px 0',
  },
  heroCtas: {
    display: 'flex',
    gap: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 64,
  },
  ctaPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'linear-gradient(135deg, #2263ff 0%, #1a4fd4 100%)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: 10,
    padding: '13px 28px',
    fontSize: 15,
    fontWeight: 600,
    boxShadow: '0 4px 32px rgba(34,99,255,0.35)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  ctaSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    color: '#c9d5e0',
    textDecoration: 'none',
    borderRadius: 10,
    padding: '13px 28px',
    fontSize: 15,
    fontWeight: 600,
    border: '1px solid #243245',
    transition: 'background 0.15s, color 0.15s',
  },

  // Hero preview card
  heroCard: {
    width: '100%',
    maxWidth: 700,
    background: '#0d1521',
    border: '1px solid #1f2a36',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
  },
  heroCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '12px 16px',
    background: '#0a1018',
    borderBottom: '1px solid #1f2a36',
  },
  heroCardDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#ef4444',
  },
  heroCardTitle: {
    fontSize: 12,
    color: '#4a5568',
    marginLeft: 6,
    fontWeight: 500,
  },
  heroCardBody: {
    gap: 0,
  },
  heroStatCard: {
    padding: '20px 18px',
    borderRight: '1px solid #1a2333',
  },
  heroStatLabel: {
    fontSize: 11,
    color: '#4a5568',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 8,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  heroStatChange: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: 600,
  },

  // Stats strip
  statsStrip: {
    background: '#0a111a',
    borderTop: '1px solid #1a2333',
    borderBottom: '1px solid #1a2333',
  },
  statItem: {
    padding: '36px 24px',
    textAlign: 'center',
    borderRight: '1px solid #1a2333',
  },
  statValue: {
    fontSize: 40,
    fontWeight: 800,
    color: '#2263ff',
    letterSpacing: '-1px',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  // Sections
  section: {
    padding: '96px 0',
  },
  sectionInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 32px',
  },
  sectionHead: {
    textAlign: 'center',
    marginBottom: 64,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: 700,
    color: '#2263ff',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 'clamp(28px, 4vw, 42px)',
    fontWeight: 800,
    color: '#e8eef5',
    margin: '0 0 16px 0',
    letterSpacing: '-1px',
  },
  sectionDesc: {
    fontSize: 17,
    color: '#8b949e',
    maxWidth: 600,
    margin: '0 auto',
    lineHeight: 1.65,
  },

  // Feature grid
  featureGrid: {
  },
  featureCard: {
    background: '#0d1521',
    border: '1px solid #1a2333',
    borderRadius: 14,
    padding: '28px 24px',
    transition: 'border-color 0.2s, transform 0.2s',
  },
  featureIconWrap: {
    width: 46,
    height: 46,
    background: 'rgba(34,99,255,0.12)',
    border: '1px solid rgba(34,99,255,0.2)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#4d8fff',
    marginBottom: 18,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e8eef5',
    margin: '0 0 10px 0',
  },
  featureDesc: {
    fontSize: 14,
    color: '#8b949e',
    lineHeight: 1.65,
    margin: 0,
  },

  // Why grid
  whyGrid: {
  },
  whyCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    background: '#0d1521',
    border: '1px solid #1a2333',
    borderRadius: 12,
    padding: '20px 20px',
  },
  whyIconWrap: {
    width: 36,
    height: 36,
    background: 'rgba(34,99,255,0.1)',
    borderRadius: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#4d8fff',
    flexShrink: 0,
    marginTop: 2,
  },
  whyTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e8eef5',
    marginBottom: 5,
  },
  whyDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 1.55,
  },

  // CTA banner
  ctaBanner: {
    position: 'relative',
    overflow: 'hidden',
    background: '#0a111a',
    borderTop: '1px solid #1a2333',
    borderBottom: '1px solid #1a2333',
    padding: '96px 32px',
    textAlign: 'center',
  },
  ctaBannerGlow: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse 800px 400px at 50% 50%, rgba(34,99,255,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  ctaBannerInner: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 600,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
  },
  ctaBannerTitle: {
    fontSize: 'clamp(26px, 4vw, 40px)',
    fontWeight: 800,
    color: '#e8eef5',
    margin: 0,
    letterSpacing: '-1px',
  },
  ctaBannerSub: {
    fontSize: 17,
    color: '#8b949e',
    margin: 0,
    lineHeight: 1.6,
  },

  // Footer
  footer: {
    background: '#060a10',
    borderTop: '1px solid #1a2333',
    padding: '40px 32px',
  },
  footerInner: {
    maxWidth: 1200,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  footerBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
  },
  footerBrandName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e8eef5',
  },
  footerPowered: {
    fontSize: 13,
    color: '#374151',
    margin: 0,
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  footerCopy: {
    fontSize: 13,
    color: '#374151',
    margin: 0,
  },
}
