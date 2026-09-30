import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { initializePaddle, Paddle, CheckoutEventNames } from '@paddle/paddle-js'
import { useAuth } from '../auth/useAuth'
import {
	PiCheckCircleDuotone, PiXCircleDuotone, PiCrownDuotone, PiRocketLaunchDuotone,
	PiSpinnerGapBold, PiSparkleDuotone, PiShieldCheckDuotone,
} from 'react-icons/pi'

type PlanKey = 'pro' | 'max'

const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined
const PADDLE_ENV = ((import.meta.env.VITE_PADDLE_ENV as string | undefined) || 'sandbox') as 'sandbox' | 'production'
const PRICE_IDS: Record<PlanKey, string | undefined> = {
	pro: import.meta.env.VITE_PADDLE_PRICE_ID_PRO as string | undefined,
	max: import.meta.env.VITE_PADDLE_PRICE_ID_MAX as string | undefined,
}

function formatTrial(frequency: number, interval: string): string {
	// Hyphenated compound adjective stays singular regardless of count —
	// "30-day trial", not "30-days trial".
	return `${frequency}-${interval} free trial`
}

const PLANS: Record<PlanKey, {
	name: string
	tagline: string
	icon: JSX.Element
	included: string[]
	excluded: string[]
}> = {
	pro: {
		name: 'Pro',
		tagline: 'For a single store getting started with real inventory control.',
		icon: <PiRocketLaunchDuotone size={22} />,
		included: [
			'1 branch',
			'Items, purchases & inventory',
			'Billing & invoicing',
			'Expenses & assets',
			'Profit & loss, daily sales reports',
		],
		excluded: ['Barcode label generation', 'Multiple branches', 'Staff accounts'],
	},
	max: {
		name: 'Max',
		tagline: 'For growing businesses running more than one location.',
		icon: <PiCrownDuotone size={22} />,
		included: [
			'Everything in Pro',
			'Unlimited branches',
			'Staff accounts with roles',
			'Barcode label generation',
		],
		excluded: [],
	},
}

export default function PricingPage() {
	const { user } = useAuth()
	const navigate = useNavigate()

	const [paddle, setPaddle] = useState<Paddle | undefined>()
	const [prices, setPrices] = useState<Partial<Record<PlanKey, { amount: string; interval: string; trial: string | null }>>>({})
	const [checkoutError, setCheckoutError] = useState('')
	// A ref, not state: the Paddle event callback below is registered once at
	// mount (initializePaddle must not be called again on every click), so a
	// state variable would be read as its stale initial value inside that
	// closure — the ref always reflects the latest choosePlan() call.
	const pendingPlanRef = useRef<PlanKey | null>(null)

	useEffect(() => {
		if (!CLIENT_TOKEN) return
		initializePaddle({
			token: CLIENT_TOKEN,
			environment: PADDLE_ENV,
			eventCallback: (event) => {
				if (event.name === CheckoutEventNames.CHECKOUT_ERROR || event.name === CheckoutEventNames.CHECKOUT_PAYMENT_ERROR) {
					console.error('Paddle checkout error:', event)
					setCheckoutError(event.detail || event.code || 'Checkout failed for an unknown reason.')
					return
				}
				if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED && event.data && pendingPlanRef.current) {
					const trialPeriod = event.data.items?.[0]?.trial_period
					navigate('/register', {
						state: {
							plan: pendingPlanRef.current,
							email: event.data.customer?.email || '',
							customerId: event.data.customer?.id || '',
							transactionId: event.data.transaction_id || '',
							trial: trialPeriod ? formatTrial(trialPeriod.frequency, trialPeriod.interval) : null,
						},
					})
				}
			},
		}).then(instance => { if (instance) setPaddle(instance) })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (!paddle) return
		(['pro', 'max'] as PlanKey[]).forEach(key => {
			const priceId = PRICE_IDS[key]
			if (!priceId) return
			paddle.PricePreview({ items: [{ priceId, quantity: 1 }] }).then(res => {
				const line = res.data.details.lineItems[0]
				if (!line) return
				const cycle = line.price.billingCycle
				const trial = line.price.trialPeriod
				setPrices(prev => ({
					...prev,
					[key]: {
						amount: line.formattedTotals.total,
						interval: cycle ? `/${cycle.interval}` : '',
						trial: trial ? formatTrial(trial.frequency, trial.interval) : null,
					},
				}))
			}).catch(() => { /* price preview is a nice-to-have — plan still purchasable without it */ })
		})
	}, [paddle])

	function choosePlan(key: PlanKey) {
		const priceId = PRICE_IDS[key]
		if (!paddle || !priceId) return
		setCheckoutError('')
		pendingPlanRef.current = key
		paddle.Checkout.open({
			items: [{ priceId, quantity: 1 }],
			customer: user?.email ? { email: user.email } : undefined,
		})
	}

	return (
		<div style={s.page}>
			<style>{CSS}</style>

			{/* ── NAV ── */}
			<nav style={s.nav}>
				<div style={s.navInner}>
					<Link to="/welcome" style={s.navBrand}>
						<img src="./logo.png" alt="Managify" width={30} style={{ borderRadius: 7 }} />
						<span style={s.navBrandName}>Managify</span>
					</Link>
					<Link to="/login" className="pp-nav-login" style={s.navLogin}>Sign In</Link>
				</div>
			</nav>

			{/* ── HERO ── */}
			<section style={s.hero}>
				<div style={s.heroBg} />
				<div style={s.heroContent}>
					<div style={s.badge}>
						<PiSparkleDuotone size={13} />
						<span>Simple, Transparent Pricing</span>
					</div>
					<h1 style={s.heroH1}>
						Pick the plan that<br />
						fits <span style={s.heroAccent}>your store</span>
					</h1>
					<p style={s.heroSub}>
						Start with a free trial on any plan — cancel anytime before it ends and you won't be charged.
					</p>
				</div>
			</section>

			{/* ── PLANS ── */}
			<section style={s.plansSection}>
				{checkoutError && (
					<div role="alert" style={s.checkoutErrorBanner}>
						<strong>Checkout failed:</strong> {checkoutError}
					</div>
				)}
				<div style={s.plansGrid}>
					{(['pro', 'max'] as PlanKey[]).map((key, i) => {
						const plan = PLANS[key]
						const price = prices[key]
						const configured = !!PRICE_IDS[key]
						const isMax = key === 'max'
						return (
							<div
								key={key}
								className={isMax ? 'pp-card pp-card-featured' : 'pp-card'}
								style={{ ...s.planCard, ...(isMax ? s.planCardFeatured : {}), animationDelay: `${i * 90}ms` }}
							>
								{isMax && (
									<span style={s.popularBadge}>
										<PiCrownDuotone size={12} /> MOST POPULAR
									</span>
								)}

								<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
									<span style={s.planIconWrap}>{plan.icon}</span>
									<h2 style={s.planName}>{plan.name}</h2>
								</div>
								<p style={s.planTagline}>{plan.tagline}</p>

								<div style={s.priceBlock}>
									{price ? (
										<>
											{price.trial && <div style={s.trialBadge}><PiSparkleDuotone size={12} /> {price.trial}</div>}
											<div>
												{price.trial && <span style={s.thenLabel}>then </span>}
												<span style={s.planPrice}>{price.amount}</span><span style={s.planInterval}>{price.interval}</span>
											</div>
											<div style={s.billedNote}>Billed monthly · cancel anytime</div>
										</>
									) : configured ? (
										<span style={s.planLoading}><PiSpinnerGapBold size={14} style={{ animation: 'pp-spin 0.8s linear infinite' }} /> Loading price…</span>
									) : (
										<span style={s.planLoading}>Coming soon</span>
									)}
								</div>

								<button
									onClick={() => choosePlan(key)}
									disabled={!configured || !paddle}
									className={isMax ? 'pp-cta-primary' : 'pp-cta-secondary'}
									style={{ ...(isMax ? s.ctaPrimary : s.ctaSecondary), width: '100%', justifyContent: 'center', marginBottom: 26, opacity: (!configured || !paddle) ? 0.5 : 1, cursor: (!configured || !paddle) ? 'not-allowed' : 'pointer' }}
								>
									{!configured ? 'Coming Soon' : price?.trial ? 'Start Free Trial' : `Choose ${plan.name}`}
								</button>

								<div style={s.divider} />

								<ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0 }}>
									{plan.included.map(f => (
										<li key={f} style={s.featureRow}>
											<span style={s.checkIconWrap}><PiCheckCircleDuotone size={14} /></span> {f}
										</li>
									))}
									{plan.excluded.map(f => (
										<li key={f} style={{ ...s.featureRow, color: '#8b96a5' }}>
											<span style={s.xIconWrap}><PiXCircleDuotone size={14} /></span>
											<span style={{ textDecoration: 'line-through', textDecorationColor: '#cbd3dd' }}>{f}</span>
										</li>
									))}
								</ul>

								<div style={s.trustRow}>
									<PiShieldCheckDuotone size={14} />
									<span>No long-term contract — cancel anytime</span>
								</div>
							</div>
						)
					})}
				</div>

				<p style={s.footnote}>
					A payment method is required to start your trial, but you won't be charged until it ends.
					Payments securely processed by Paddle. Prices shown include tax where applicable. By subscribing
					you agree to our{' '}
					<Link to="/terms" style={s.footnoteLink}>Terms of Service</Link>,{' '}
					<Link to="/privacy" style={s.footnoteLink}>Privacy Policy</Link>, and{' '}
					<Link to="/refund-policy" style={s.footnoteLink}>Refund Policy</Link>.
				</p>
			</section>
		</div>
	)
}

const CSS = `
@keyframes pp-spin { to { transform: rotate(360deg); } }
@keyframes pp-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

.pp-card {
	animation: pp-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.pp-card:hover {
	transform: translateY(-4px);
	border-color: #cbd3dd;
	box-shadow: 0 28px 60px rgba(15,23,42,0.14);
}
.pp-card.pp-card-featured:hover {
	border-color: #2263ff;
}

.pp-cta-primary, .pp-cta-secondary, .pp-nav-login {
	transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.pp-cta-primary:hover:not(:disabled) {
	transform: translateY(-1px);
	box-shadow: 0 6px 40px rgba(34,99,255,0.45);
}
.pp-cta-primary:active:not(:disabled) { transform: translateY(0); }
.pp-cta-secondary:hover:not(:disabled) {
	background: #f3f5f8;
	border-color: #cbd3dd;
}
.pp-nav-login:hover { background: #e8ecf2; border-color: #cbd3dd; }

.pp-cta-primary:focus-visible, .pp-cta-secondary:focus-visible, .pp-nav-login:focus-visible {
	outline: 2px solid #2263ff;
	outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
	.pp-card { animation: none; }
	.pp-card:hover { transform: none; }
	.pp-cta-primary:hover:not(:disabled), .pp-cta-secondary:hover:not(:disabled) { transform: none; }
}
`

const s: Record<string, React.CSSProperties> = {
	page: {
		background: '#ffffff',
		color: '#16202c',
		fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
		minHeight: '100vh',
	},
	nav: {
		position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
		background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
		borderBottom: '1px solid rgba(0,0,0,0.06)',
	},
	navInner: {
		maxWidth: 1200, margin: '0 auto', padding: '0 32px', height: 64,
		display: 'flex', alignItems: 'center', justifyContent: 'space-between',
	},
	navBrand: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
	navBrandName: { fontSize: 18, fontWeight: 700, color: '#16202c', letterSpacing: '-0.3px' },
	navLogin: {
		fontSize: 14, fontWeight: 600, color: '#16202c', textDecoration: 'none',
		background: '#eef1f5', border: '1px solid #cbd3dd', borderRadius: 8, padding: '7px 18px',
	},
	hero: { position: 'relative', paddingTop: 150, paddingBottom: 56, overflow: 'hidden' },
	heroBg: {
		position: 'absolute', inset: 0,
		background: 'radial-gradient(ellipse 800px 500px at 50% 0%, rgba(34,99,255,0.08) 0%, transparent 70%)',
		pointerEvents: 'none',
	},
	heroContent: {
		maxWidth: 700, margin: '0 auto', padding: '0 32px',
		display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative',
	},
	badge: {
		display: 'inline-flex', alignItems: 'center', gap: 7,
		background: 'rgba(34,99,255,0.08)', border: '1px solid rgba(34,99,255,0.25)',
		borderRadius: 99, padding: '5px 14px', fontSize: 12, fontWeight: 600,
		color: '#2263ff', letterSpacing: '0.5px', marginBottom: 24, textTransform: 'uppercase',
	},
	heroH1: {
		fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, lineHeight: 1.15,
		letterSpacing: '-1.5px', color: '#16202c', margin: '0 0 18px 0',
	},
	heroAccent: {
		background: 'linear-gradient(90deg, #2263ff, #1a4fd4)',
		WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
	},
	heroSub: { fontSize: 16, lineHeight: 1.7, color: '#5b6675', maxWidth: 520, margin: 0 },

	plansSection: { maxWidth: 980, margin: '0 auto', padding: '0 32px 100px', position: 'relative' },
	checkoutErrorBanner: {
		maxWidth: 700, margin: '0 auto 28px', padding: '12px 16px', borderRadius: 10,
		background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)',
		color: '#dc2626', fontSize: 13.5, lineHeight: 1.5, textAlign: 'center',
	},
	plansGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'stretch' },
	planCard: {
		position: 'relative', display: 'flex', flexDirection: 'column',
		background: '#ffffff',
		border: '1px solid #e2e6ec', borderRadius: 18,
		padding: 32, boxShadow: '0 20px 48px rgba(15,23,42,0.08)',
	},
	planCardFeatured: { border: '1px solid #aec3f7' },
	popularBadge: {
		position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
		display: 'inline-flex', alignItems: 'center', gap: 5,
		background: 'linear-gradient(135deg, #2263ff 0%, #1a4fd4 100%)', color: '#fff',
		fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 999, letterSpacing: '0.4px',
		boxShadow: '0 4px 20px rgba(34,99,255,0.35)', whiteSpace: 'nowrap',
	},
	planIconWrap: {
		display: 'flex', alignItems: 'center', justifyContent: 'center',
		width: 34, height: 34, borderRadius: 9, color: '#2263ff',
		background: 'rgba(34,99,255,0.08)', flexShrink: 0,
	},
	planName: { margin: 0, fontSize: 21, fontWeight: 700, color: '#16202c', letterSpacing: '-0.2px' },
	planTagline: { margin: '0 0 24px', color: '#5b6675', fontSize: 13.5, lineHeight: 1.55, minHeight: 40 },
	priceBlock: { marginBottom: 24, minHeight: 78 },
	planPrice: { fontSize: 36, fontWeight: 800, color: '#16202c', letterSpacing: '-0.5px' },
	planInterval: { color: '#5b6675', fontSize: 14 },
	billedNote: { color: '#8b96a5', fontSize: 12, marginTop: 4 },
	trialBadge: {
		display: 'inline-flex', alignItems: 'center', gap: 5, color: '#16a34a',
		fontSize: 12.5, fontWeight: 700, marginBottom: 7,
	},
	thenLabel: { color: '#5b6675', fontSize: 14 },
	planLoading: { display: 'flex', alignItems: 'center', gap: 6, color: '#5b6675', fontSize: 15, fontWeight: 600 },
	divider: { height: 1, background: 'linear-gradient(90deg, transparent, #e2e6ec, transparent)' },
	featureRow: { display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 12, fontSize: 13.5, color: '#334155', lineHeight: 1.4 },
	checkIconWrap: {
		display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
		width: 18, height: 18, borderRadius: '50%', background: 'rgba(22,163,74,0.1)', color: '#16a34a',
	},
	xIconWrap: {
		display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
		width: 18, height: 18, borderRadius: '50%', background: 'rgba(139,150,165,0.15)', color: '#8b96a5',
	},
	trustRow: {
		marginTop: 'auto', paddingTop: 24, display: 'flex', alignItems: 'center', gap: 7,
		color: '#8b96a5', fontSize: 12,
	},
	footnote: { textAlign: 'center', color: '#8b96a5', fontSize: 12.5, marginTop: 44, lineHeight: 1.6, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' },
	footnoteLink: { color: '#5b6675', textDecoration: 'underline' },

	ctaPrimary: {
		display: 'inline-flex', alignItems: 'center', gap: 8,
		background: 'linear-gradient(135deg, #2263ff 0%, #1a4fd4 100%)', color: 'white',
		border: 'none', borderRadius: 10, padding: '13px 20px', fontSize: 14.5, fontWeight: 700,
		boxShadow: '0 4px 32px rgba(34,99,255,0.3)',
	},
	ctaSecondary: {
		display: 'inline-flex', alignItems: 'center', gap: 8,
		background: 'transparent', color: '#334155',
		border: '1px solid #cbd3dd', borderRadius: 10, padding: '13px 20px', fontSize: 14.5, fontWeight: 700,
	},
}
