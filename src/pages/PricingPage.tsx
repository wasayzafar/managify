import { useLandingFont } from '../utils/landingFont'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { initializePaddle, Paddle, CheckoutEventNames } from '@paddle/paddle-js'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../supabase'
import PublicNav from '../components/PublicNav'
import {
	PiBriefcaseDuotone, PiDatabaseDuotone, PiReceiptDuotone, PiUsersThreeDuotone, PiBarcodeDuotone,
	PiCheckBold, PiXDuotone, PiSpinnerGapBold, PiSparkleDuotone, PiCrownDuotone, PiShieldCheckDuotone,
} from 'react-icons/pi'

type PlanKey = 'pro' | 'max' | 'restaurant' | 'bakery'

const PLAN_ORDER: PlanKey[] = ['pro', 'max', 'restaurant', 'bakery']

const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined
const PADDLE_ENV = ((import.meta.env.VITE_PADDLE_ENV as string | undefined) || 'sandbox') as 'sandbox' | 'production'
const PRICE_IDS: Record<PlanKey, string | undefined> = {
	pro: import.meta.env.VITE_PADDLE_PRICE_ID_PRO as string | undefined,
	max: import.meta.env.VITE_PADDLE_PRICE_ID_MAX as string | undefined,
	restaurant: import.meta.env.VITE_PADDLE_PRICE_ID_RESTAURANT as string | undefined,
	bakery: import.meta.env.VITE_PADDLE_PRICE_ID_BAKERY as string | undefined,
}

function formatTrial(frequency: number, interval: string): string {
	// Hyphenated compound adjective stays singular regardless of count —
	// "30-day trial", not "30-days trial".
	return `${frequency}-${interval} free trial`
}

const PLANS: Record<PlanKey, {
	name: string
	description: string
	popular: boolean
	features: { text: string; icon: JSX.Element }[]
	includes: string[]
	excluded: string[]
}> = {
	pro: {
		name: 'Pro',
		description: 'For a single store getting started with real inventory control.',
		popular: false,
		features: [
			{ text: '1 branch', icon: <PiBriefcaseDuotone size={20} /> },
			{ text: 'Items, purchases & inventory', icon: <PiDatabaseDuotone size={20} /> },
			{ text: 'Billing & invoicing', icon: <PiReceiptDuotone size={20} /> },
		],
		includes: ['Also included:', 'Expenses & assets', 'Profit & loss and daily sales reports'],
		excluded: ['Barcode label generation', 'Multiple branches', 'Staff accounts'],
	},
	max: {
		name: 'Max',
		description: 'For growing businesses running more than one location.',
		popular: true,
		features: [
			{ text: 'Unlimited branches', icon: <PiBriefcaseDuotone size={20} /> },
			{ text: 'Staff accounts with roles', icon: <PiUsersThreeDuotone size={20} /> },
			{ text: 'Barcode label generation', icon: <PiBarcodeDuotone size={20} /> },
		],
		includes: ['Everything in Pro, plus:', 'Items, purchases & inventory', 'Billing & invoicing', 'Expenses & assets', 'Profit & loss and daily sales reports'],
		excluded: [],
	},
	restaurant: {
		name: 'Restaurant POS',
		description: 'A custom-configured point of sale for restaurants and cafés, with dedicated setup for your menu and locations.',
		popular: false,
		features: [
			{ text: 'Unlimited branches', icon: <PiBriefcaseDuotone size={20} /> },
			{ text: 'Staff accounts with roles', icon: <PiUsersThreeDuotone size={20} /> },
			{ text: 'Fast counter & order billing', icon: <PiReceiptDuotone size={20} /> },
		],
		includes: ['Everything in Max, plus:', 'Menu items set up as your catalog', 'Dedicated onboarding for restaurant workflows'],
		excluded: [],
	},
	bakery: {
		name: 'Bakery Production & POS',
		description: 'A custom-configured system for bakeries, tracking ingredients, finished goods, and daily sales.',
		popular: false,
		features: [
			{ text: 'Ingredient purchases & inventory', icon: <PiDatabaseDuotone size={20} /> },
			{ text: 'Finished goods labeling', icon: <PiBarcodeDuotone size={20} /> },
			{ text: 'Unlimited branches', icon: <PiBriefcaseDuotone size={20} /> },
		],
		includes: ['Everything in Max, plus:', 'Dedicated onboarding for ingredient & finished-goods tracking', 'Staff accounts with roles'],
		excluded: [],
	},
}

export default function PricingPage() {
  useLandingFont()
	const { user } = useAuth()
	const navigate = useNavigate()

	const [paddle, setPaddle] = useState<Paddle | undefined>()
	const [prices, setPrices] = useState<Partial<Record<PlanKey, { amount: string; interval: string; trial: string | null }>>>({})
	const [checkoutError, setCheckoutError] = useState('')
	// Refs, not state: the Paddle event callback is registered once at mount
	// (initializePaddle must not run again on every click), so state would be
	// read as its stale initial value inside that closure.
	const pendingPlanRef = useRef<PlanKey | null>(null)
	const userRef = useRef(user)
	userRef.current = user

	async function activatePlan(plan: PlanKey, uid: string, email: string, customerId?: string, transactionId?: string) {
		const { error } = await supabase.from('user_registry').upsert({
			uid,
			email,
			plan,
			paddle_customer_id: customerId || null,
			paddle_transaction_id: transactionId || null,
		}, { onConflict: 'uid' })
		if (error) {
			setCheckoutError(`Payment received, but we could not activate your plan. Contact support with transaction ${transactionId}.`)
			return
		}
		navigate('/', { replace: true })
	}

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
					const current = userRef.current
					if (!current) { navigate('/register'); return }
					activatePlan(pendingPlanRef.current, current.uid, current.email || '', event.data.customer?.id, event.data.transaction_id)
				}
			},
		}).then(instance => { if (instance) setPaddle(instance) })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (!paddle) return
		PLAN_ORDER.forEach(key => {
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
		const current = userRef.current
		if (!current) { navigate('/register'); return }
		const priceId = PRICE_IDS[key]
		if (!paddle || !priceId) return
		setCheckoutError('')
		pendingPlanRef.current = key
		paddle.Checkout.open({
			items: [{ priceId, quantity: 1 }],
			customer: current.email ? { email: current.email } : undefined,
		})
	}

	return (
		<div className="pub-page" style={s.page}>
			<style>{CSS}</style>

			<PublicNav />

			<div style={s.header}>
				<div style={s.badge}>
					<PiSparkleDuotone size={13} />
					<span>Simple, transparent pricing</span>
				</div>
				<h1 style={s.heroH1}>
					Plans that work best for your{' '}
					<span style={s.highlight}>business</span>
				</h1>
				<p style={s.heroSub}>
					{user
						? 'Choose a plan to start your free trial. Cancel anytime before it ends and you won\'t be charged.'
						: 'Create your account first, then choose a plan to start your free trial.'}
				</p>
			</div>

			<section style={s.plansSection}>
				{checkoutError && (
					<div role="alert" style={s.checkoutErrorBanner}>
						<strong>Checkout failed:</strong> {checkoutError}
					</div>
				)}

				<div style={s.plansGrid}>
					{PLAN_ORDER.map((key, i) => {
						const plan = PLANS[key]
						const price = prices[key]
						const configured = !!PRICE_IDS[key]
						const cardStyle = plan.popular ? { ...s.card, ...s.cardPopular } : s.card
						return (
							<div key={key} className="pp-card" style={{ ...cardStyle, animationDelay: `${i * 150}ms` }}>
								<div style={s.cardHeader}>
									<div style={s.cardTitleRow}>
										<h2 style={s.planName}>{plan.name}</h2>
										{plan.popular && (
											<span style={s.popularBadge}>
												<PiCrownDuotone size={12} /> Popular
											</span>
										)}
									</div>
									<p style={s.planDescription}>{plan.description}</p>

									<div style={s.priceBlock}>
										{price ? (
											<>
												{price.trial && <div style={s.trialBadge}><PiSparkleDuotone size={12} /> {price.trial}</div>}
												<div style={s.priceRow}>
													{price.trial && <span style={s.thenLabel}>then</span>}
													<span style={s.planPrice}>{price.amount}</span>
													<span style={s.planInterval}>{price.interval || '/month'}</span>
												</div>
											</>
										) : configured ? (
											<span style={s.planLoading}><PiSpinnerGapBold size={14} style={{ animation: 'pp-spin 0.8s linear infinite' }} /> Loading price…</span>
										) : (
											<span style={s.planLoading}>Coming soon</span>
										)}
									</div>

									<button
										onClick={() => choosePlan(key)}
										disabled={!configured || (!!user && !paddle)}
										className={plan.popular ? 'pp-cta-primary' : 'pp-cta-dark'}
										style={{
											...s.cta,
											...(plan.popular ? s.ctaPopular : s.ctaDark),
											opacity: (!configured || (!!user && !paddle)) ? 0.5 : 1,
											cursor: (!configured || (!!user && !paddle)) ? 'not-allowed' : 'pointer',
										}}
									>
										{!configured ? 'Coming Soon' : !user ? 'Create account to continue' : price?.trial ? 'Start free trial' : `Choose ${plan.name}`}
									</button>
								</div>

								<div style={s.cardBody}>
									<ul style={s.featureList}>
										{plan.features.map(f => (
											<li key={f.text} style={s.featureItem}>
												<span style={s.featureIcon}>{f.icon}</span>
												<span style={s.featureText}>{f.text}</span>
											</li>
										))}
									</ul>

									<div style={s.includesBox}>
										<h4 style={s.includesHeading}>{plan.includes[0]}</h4>
										<ul style={s.includesList}>
											{plan.includes.slice(1).map(item => (
												<li key={item} style={s.includesItem}>
													<span style={s.checkBadge}><PiCheckBold size={11} /></span>
													<span style={s.includesText}>{item}</span>
												</li>
											))}
											{plan.excluded.map(item => (
												<li key={item} style={{ ...s.includesItem, color: '#94a3b8' }}>
													<span style={s.xBadge}><PiXDuotone size={11} /></span>
													<span style={{ ...s.includesText, textDecoration: 'line-through', color: '#94a3b8' }}>{item}</span>
												</li>
											))}
										</ul>
									</div>
								</div>
							</div>
						)
					})}
				</div>

				<div style={s.trustRow}>
					<PiShieldCheckDuotone size={14} />
					<span>No long-term contract — cancel anytime</span>
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
@keyframes pp-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

.pp-card { animation: pp-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
.pp-card:hover { border-color: #cbd5e1; box-shadow: 0 6px 18px rgba(15,23,42,0.07); }

.pp-cta-primary, .pp-cta-dark, .pp-nav-login {
	transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.pp-cta-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(34,99,255,0.3); }
.pp-cta-dark:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(15,23,42,0.25); }
.pp-cta-primary:active:not(:disabled), .pp-cta-dark:active:not(:disabled) { transform: translateY(0); }
.pp-nav-login:hover { background: #e2e8f0; border-color: #cbd5e1; }

.pp-cta-primary:focus-visible, .pp-cta-dark:focus-visible, .pp-nav-login:focus-visible {
	outline: 2px solid #2263ff;
	outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
	.pp-card { animation: none; }
	.pp-cta-primary:hover:not(:disabled), .pp-cta-dark:hover:not(:disabled) { transform: none; }
}
`

const s: Record<string, React.CSSProperties> = {
	page: {
		background: '#f8fafc',
		color: '#0f172a',
		fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
		minHeight: '100vh',
		paddingBottom: 80,
	},

	header: { textAlign: 'center', padding: '140px 24px 40px', maxWidth: 760, margin: '0 auto' },
	badge: {
		display: 'inline-flex', alignItems: 'center', gap: 7,
		background: '#eff4ff', border: '1px solid #dbe6fe',
		borderRadius: 99, padding: '5px 14px', fontSize: 12, fontWeight: 500,
		color: '#2263ff', letterSpacing: '0.5px', marginBottom: 20, textTransform: 'uppercase',
	},
	heroH1: {
		fontSize: 'clamp(30px, 4.5vw, 50px)', fontWeight: 600, lineHeight: 1.15,
		letterSpacing: '-1.2px', color: '#0f172a', margin: '0 0 16px 0',
	},
	highlight: {
		display: 'inline-block', border: '1px dashed #2263ff', borderRadius: 12,
		background: '#eff4ff', color: '#2263ff', padding: '0 10px', textTransform: 'capitalize',
	},
	heroSub: { fontSize: 16, lineHeight: 1.65, color: '#475569', maxWidth: 560, margin: '0 auto' },

	plansSection: { maxWidth: 1180, margin: '0 auto', padding: '0 24px' },
	checkoutErrorBanner: {
		maxWidth: 700, margin: '0 auto 24px', padding: '12px 16px', borderRadius: 8,
		background: '#fef2f2', border: '1px solid #fecaca',
		color: '#dc2626', fontSize: 13.5, lineHeight: 1.5, textAlign: 'center',
	},
	plansGrid: {
		display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
		gap: 20, alignItems: 'stretch',
	},

	card: {
		display: 'flex', flexDirection: 'column',
		background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14,
		overflow: 'hidden',
	},
	cardPopular: {
		border: '2px solid #2263ff', background: '#f7faff',
	},
	cardHeader: { padding: '26px 26px 22px', borderBottom: '1px solid #e2e8f0' },
	cardTitleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 },
	planName: { margin: 0, fontSize: 24, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.3px' },
	popularBadge: {
		display: 'inline-flex', alignItems: 'center', gap: 5,
		background: '#2263ff', color: '#fff', fontSize: 12, fontWeight: 600,
		padding: '4px 11px', borderRadius: 999, whiteSpace: 'nowrap',
	},
	planDescription: { margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.55, color: '#475569', minHeight: 42 },
	priceBlock: { minHeight: 74, marginBottom: 18 },
	trialBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, color: '#16a34a', fontSize: 12.5, fontWeight: 600, marginBottom: 6 },
	priceRow: { display: 'flex', alignItems: 'baseline', gap: 6 },
	thenLabel: { color: '#475569', fontSize: 14 },
	planPrice: { fontSize: 38, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.8px' },
	planInterval: { color: '#475569', fontSize: 14 },
	planLoading: { display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 15, fontWeight: 500 },

	cta: {
		width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
		borderRadius: 10, padding: '13px 18px', fontSize: 15, fontWeight: 600,
		border: 'none', color: '#ffffff',
	},
	ctaPopular: { background: 'linear-gradient(to top, #1d56d6, #2263ff)', boxShadow: '0 6px 16px rgba(34,99,255,0.25)' },
	ctaDark: { background: 'linear-gradient(to top, #020617, #334155)', boxShadow: '0 6px 16px rgba(15,23,42,0.18)' },

	cardBody: { padding: '22px 26px 26px', display: 'flex', flexDirection: 'column', gap: 22, flex: 1 },
	featureList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 },
	featureItem: { display: 'flex', alignItems: 'center', gap: 12 },
	featureIcon: { display: 'flex', color: '#2263ff', flexShrink: 0 },
	featureText: { fontSize: 14, fontWeight: 500, color: '#0f172a' },

	includesBox: { borderTop: '1px solid #e2e8f0', paddingTop: 18 },
	includesHeading: { margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#0f172a' },
	includesList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 },
	includesItem: { display: 'flex', alignItems: 'center', gap: 10 },
	includesText: { fontSize: 13.5, color: '#475569' },
	checkBadge: {
		display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
		width: 20, height: 20, borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
	},
	xBadge: {
		display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
		width: 20, height: 20, borderRadius: '50%', background: '#f1f5f9', color: '#94a3b8',
	},

	trustRow: {
		marginTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
		color: '#64748b', fontSize: 13,
	},
	footnote: { textAlign: 'center', color: '#64748b', fontSize: 12.5, marginTop: 20, lineHeight: 1.6, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto' },
	footnoteLink: { color: '#475569', textDecoration: 'underline' },
}
