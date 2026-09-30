import LegalPageLayout from '../components/LegalPageLayout'

export default function RefundPolicyPage() {
	return (
		<LegalPageLayout title="Refund Policy" updated="September 30, 2026">
			<h2>Free trial first</h2>
			<p>
				Every Managify plan starts with a free trial. A payment method is required to start it, but you are
				not charged anything until the trial ends. If you cancel before then, you pay nothing — this is the
				best way to make sure a plan is right for you before any money changes hands.
			</p>

			<h2>After you've been charged</h2>
			<p>
				Because of the free trial, we generally don't offer refunds for subscription charges once the trial
				period has ended and billing has started. Cancelling stops future renewals, but the current billing
				period is non-refundable.
			</p>

			<h2>Exceptions</h2>
			<p>
				If you were charged in error, charged after a trial cancellation that didn't go through, or
				experienced a technical issue that prevented you from using the Service, contact us within 14 days
				of the charge. We review these on a case-by-case basis and will work with Paddle to issue a refund when appropriate.
			</p>

			<h2>How refunds are processed</h2>
			<p>
				Payments are processed by Paddle.com Market Limited ("Paddle"), our Merchant of Record. Approved
				refunds are issued by Paddle back to your original payment method, typically within 5–10 business
				days. Paddle's own{' '}
				<a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
					Buyer Terms of Use
				</a>{' '}
				also apply to your purchase.
			</p>

			<h2>How to request a refund</h2>
			<p>
				Email <a href="mailto:nativeedge.studio@gmail.com">nativeedge.studio@gmail.com</a> with your account
				email and the approximate date of the charge, and we'll get back to you.
			</p>
		</LegalPageLayout>
	)
}
