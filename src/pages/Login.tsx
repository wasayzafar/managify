import React, { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate, Link } from 'react-router-dom'
import { auth } from '../firebase'
import {
  FiMail, FiLock, FiLogIn, FiAlertCircle,
  FiBarChart2, FiFileText, FiPackage, FiTrendingUp
} from 'react-icons/fi'

const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/')
    } catch (err: any) {
      const code = err?.code || ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.')
      } else {
        setError('Login failed. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: <FiPackage size={16} />, label: 'Live inventory tracking' },
    { icon: <FiFileText size={16} />, label: 'Professional invoicing' },
    { icon: <FiTrendingUp size={16} />, label: 'Sales & revenue analytics' },
    { icon: <FiBarChart2 size={16} />, label: 'Profit & loss reporting' },
  ]

  return (
    <div className="lp-shell">

      {/* ── Left branding panel (desktop only) ── */}
      <div className="lp-left">
        <div style={s.leftInner}>
          <Link to="/welcome" style={{ textDecoration: 'none' }}>
            <div style={s.brand}>
              <img src="./logo.png" alt="Managify" width={38} style={{ borderRadius: 8 }} />
              <span style={s.brandName}>Managify</span>
            </div>
          </Link>

          <div style={s.heroText}>
            <h1 style={s.heroH1}>Run your store<br />smarter, faster.</h1>
            <p style={s.heroSub}>
              One platform for inventory, billing, sales, and profit tracking — built for modern retail.
            </p>
          </div>

          <div style={s.featureList}>
            {features.map(f => (
              <div key={f.label} style={s.featureItem}>
                <span style={s.featureIcon}>{f.icon}</span>
                <span style={s.featureLabel}>{f.label}</span>
              </div>
            ))}
          </div>

          <a href="https://nativeedgestudio.space" target="_blank" rel="noopener noreferrer" style={s.leftFooter}>
            <img src="./nativeedge.png" alt="NativeEdge Studio" width={18} style={{ borderRadius: 4, verticalAlign: 'middle' }} />
            {' '}Powered by <strong style={{ color: '#e8eef5' }}>NativeEdge Studio</strong>
          </a>
        </div>
        <div style={s.glow1} />
        <div style={s.glow2} />
      </div>

      {/* ── Right form panel ── */}
      <div className="lp-right">
        <div className="lp-card">

          {/* Mobile-only logo (hidden on desktop where left panel shows) */}
          <Link to="/welcome" className="lp-mobile-brand">
            <img src="./logo.png" alt="Managify" width={32} style={{ borderRadius: 7 }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: '#e8eef5', letterSpacing: '-0.3px' }}>Managify</span>
          </Link>

          <div style={s.formHeader}>
            <h2 style={s.formTitle}>Welcome back</h2>
            <p style={s.formSub}>Sign in to your account</p>
          </div>

          {error && (
            <div style={s.errorBox}>
              <FiAlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={s.form}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Email address</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}><FiMail size={16} /></span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={s.input}
                  className="lp-input"
                  autoComplete="email"
                />
              </div>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Password</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}><FiLock size={16} /></span>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={s.input}
                  className="lp-input"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <span style={s.spinnerWrap}>
                  <span style={s.spinner} />
                  Signing in…
                </span>
              ) : (
                <span style={s.btnInner}>
                  <FiLogIn size={16} />
                  Sign In
                </span>
              )}
            </button>
          </form>

          <p style={s.registerLink}>
            Don't have an account?{' '}
            <Link to="/contact" style={{ color: '#4d8fff', textDecoration: 'none', fontWeight: 600 }}>
              Contact us
            </Link>
          </p>

          <p className="lp-footer">&copy; {new Date().getFullYear()} Managify. All rights reserved.</p>
        </div>
      </div>

    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  leftInner: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 64,
  },
  brandName: {
    fontSize: 22,
    fontWeight: 700,
    color: '#e8eef5',
    letterSpacing: '-0.3px',
  },
  heroText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  heroH1: {
    fontSize: 44,
    fontWeight: 800,
    lineHeight: 1.15,
    color: '#e8eef5',
    margin: '0 0 20px 0',
    letterSpacing: '-1px',
    background: 'linear-gradient(135deg, #e8eef5 30%, #4d8fff 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSub: {
    fontSize: 17,
    lineHeight: 1.65,
    color: '#8b949e',
    margin: 0,
    maxWidth: 400,
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    marginTop: 48,
    marginBottom: 48,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    background: 'rgba(34,99,255,0.15)',
    border: '1px solid rgba(34,99,255,0.25)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#4d8fff',
    flexShrink: 0,
  },
  featureLabel: {
    fontSize: 14,
    color: '#c9d5e0',
    fontWeight: 500,
  },
  leftFooter: {
    fontSize: 13,
    color: '#4a5568',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  glow1: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(34,99,255,0.12) 0%, transparent 70%)',
    top: -100,
    right: -150,
    pointerEvents: 'none',
    zIndex: 1,
  },
  glow2: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(34,99,255,0.08) 0%, transparent 70%)',
    bottom: 0,
    left: -100,
    pointerEvents: 'none',
    zIndex: 1,
  },
  formHeader: {
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#e8eef5',
    margin: '0 0 6px 0',
    letterSpacing: '-0.5px',
  },
  formSub: {
    fontSize: 15,
    color: '#6b7280',
    margin: 0,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#fca5a5',
    marginBottom: 20,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#9ca3af',
    letterSpacing: '0.2px',
  },
  inputWrap: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 13,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#4a5568',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    background: '#0d1521',
    border: '1px solid #243245',
    borderRadius: 10,
    color: '#e8eef5',
    fontSize: 15,
    padding: '12px 14px 12px 42px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  submitBtn: {
    width: '100%',
    background: 'linear-gradient(135deg, #2263ff 0%, #1a4fd4 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
    transition: 'opacity 0.2s',
    boxShadow: '0 4px 24px rgba(34,99,255,0.3)',
  },
  btnInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  spinnerWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  spinner: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    display: 'inline-block',
  },
  registerLink: {
    textAlign: 'center' as const,
    fontSize: 14,
    color: '#6b7280',
    marginTop: 24,
    marginBottom: 0,
  },
}

export default Login
