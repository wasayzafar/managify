import { useEffect, useState } from 'react'
import { initializePaddle, Paddle, CheckoutEventNames } from '@paddle/paddle-js'
import {
	PiCreditCardDuotone, PiWarningCircleDuotone, PiCheckCircleDuotone, PiSpinnerGapBold,
} from 'react-icons/pi'

const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined
const DEFAULT_PRICE_ID = (import.meta.env.VITE_PADDLE_PRICE_ID as string | undefined) || ''
const PADDLE_ENV = ((import.meta.env.VITE_PADDLE_ENV as string | undefined) || 'sandbox') as 'sandbox' | 'production'

const fieldLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 } as const
const isLive = PADDLE_ENV === 'production'

export default function CheckoutTestPage() {
	const [paddle, setPaddle] = useState<Paddle | undefined>()
	const [priceId, setPriceId] = useState(DEFAULT_PRICE_ID)
	const [initError, setInitError] = useState('')
	const [lastEvent, setLastEvent] = useState('')
	const [completedTxId, setCompletedTxId] = useState('')

	useEffect(() => {
		if (!CLIENT_TOKEN) return
		initializePaddle({
			token: CLIENT_TOKEN,
			environment: PADDLE_ENV,
			eventCallback: (event) => {
				setLastEvent(event.name || '')
				if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
					setCompletedTxId(event.data?.transaction_id || '')
				}
			},
		})
			.then(instance => { if (instance) setPaddle(instance) })
			.catch(err => setInitError(err?.message || 'Failed to load Paddle.js.'))
	}, [])

	if (!CLIENT_TOKEN) {
		return (
			<div>
				<div style={{ marginBottom: 24 }}>
					<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Paddle Checkout Test</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>A throwaway page for testing Paddle.js — not linked in the sidebar.</p>
				</div>
				<div className="card" style={{ maxWidth: 560 }}>
					<h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
						<PiWarningCircleDuotone size={16} style={{ color: 'var(--danger)' }} /> Paddle isn't configured yet
					</h3>
					<p style={{ margin: '0 0 12px 0', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.6 }}>
						Set <code>VITE_PADDLE_CLIENT_TOKEN</code> and <code>VITE_PADDLE_PRICE_ID</code> in <code>.env</code>, then restart the dev server. To get those values:
					</p>
					<ol style={{ margin: 0, paddingLeft: 20, color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.9 }}>
						<li>Create a free sandbox account at <strong>sandbox-vendors.paddle.com</strong> (separate from production — no business verification needed).</li>
						<li>In the sandbox dashboard: <strong>Developer Tools → Authentication</strong> → create a client-side token (starts with <code>test_</code>). That's <code>VITE_PADDLE_CLIENT_TOKEN</code>.</li>
						<li><strong>Catalog → Products</strong> → New Product → give it a name and add a Price (e.g. $10/month). Copy the Price ID (starts with <code>pri_</code>) into <code>VITE_PADDLE_PRICE_ID</code>.</li>
						<li>Sandbox payments never charge real money — use test card <code>4242 4242 4242 4242</code>, any future expiry, any CVC.</li>
					</ol>
				</div>
			</div>
		)
	}

	return (
		<div>
			<div style={{ marginBottom: 24 }}>
				<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Paddle Checkout Test</h1>
				<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>A throwaway page for testing Paddle.js — not linked in the sidebar. Environment: <strong>{PADDLE_ENV}</strong></p>
			</div>

			{isLive && (
				<div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, maxWidth: 480, marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--danger-bg, rgba(239,68,68,0.1))', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 13, lineHeight: 1.5 }}>
					<PiWarningCircleDuotone size={16} style={{ flexShrink: 0, marginTop: 1 }} />
					<span><strong>Live mode.</strong> This is your production Paddle account — completing a checkout here charges a real card. There is no test card that works in this mode.</span>
				</div>
			)}

			<div className="card" style={{ maxWidth: 480 }}>
				<h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
					<PiCreditCardDuotone size={16} style={{ color: 'var(--text-muted)' }} /> Open a Checkout
				</h3>
				<p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
					{isLive
						? 'This opens a real checkout for the price below. Use a real card only if you intend to pay.'
						: <>Use Paddle's test card <code>4242 4242 4242 4242</code> — any future expiry, any CVC, any name/address.</>}
				</p>

				{initError && (
					<div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, color: 'var(--danger)', fontSize: 13 }}>
						<PiWarningCircleDuotone size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{initError}</span>
					</div>
				)}

				<label style={fieldLabelStyle}>Price ID</label>
				<input
					value={priceId}
					onChange={e => setPriceId(e.target.value)}
					placeholder="pri_xxxxxxxxxxxxxxxxxxxxxxxxxx"
					style={{ marginBottom: 14 }}
				/>

				<button
					type="button"
					disabled={!paddle || !priceId.trim()}
					onClick={() => {
						setCompletedTxId('')
						paddle?.Checkout.open({ items: [{ priceId: priceId.trim(), quantity: 1 }] })
					}}
					style={{ display: 'flex', alignItems: 'center', gap: 6 }}
				>
					{!paddle
						? <><PiSpinnerGapBold size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading Paddle…</>
						: <><PiCreditCardDuotone size={15} /> Open Checkout</>}
				</button>

				{lastEvent && (
					<p style={{ margin: '14px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
						Last event: <code>{lastEvent}</code>
					</p>
				)}

				{completedTxId && (
					<div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', fontSize: 13, lineHeight: 1.5 }}>
						<PiCheckCircleDuotone size={16} style={{ flexShrink: 0, marginTop: 1 }} />
						<span>Checkout completed. Transaction <strong>{completedTxId}</strong>.</span>
					</div>
				)}
			</div>
		</div>
	)
}
