import LegalPageLayout from '../components/LegalPageLayout'

export default function PrivacyPolicyPage() {
	return (
		<LegalPageLayout title="Privacy Policy" updated="September 30, 2026">
			<h2>Who we are</h2>
			<p>
				Managify is operated by NativeEdge Studio ("we", "us", "our"), based in Karachi, Pakistan.
				This policy explains what information we collect through Managify (the "Service") and how we use it.
			</p>

			<h2>Information we collect</h2>
			<ul>
				<li><strong>Account information</strong> — your email address and display name, managed through Firebase Authentication.</li>
				<li><strong>Business data you enter</strong> — inventory, purchases, sales, invoices, customers, suppliers, employees, and related records you create while using Managify, stored in our Supabase database.</li>
				<li><strong>Billing information</strong> — subscription payments are handled entirely by Paddle.com Market Limited ("Paddle"), our payment provider and Merchant of Record. We never receive or store your card details.</li>
				<li><strong>Usage metadata</strong> — last sign-in time and basic account status, used to operate and secure the Service.</li>
				<li><strong>Contact form submissions</strong> — if you message us through the Contact page, it's delivered via EmailJS.</li>
			</ul>

			<h2>How we use it</h2>
			<p>
				We use this information to provide and secure the Service, process subscription billing, respond to
				support requests, and improve Managify. We do not sell your data, and we do not use your business
				data (inventory, sales, customer records) for anything other than displaying it back to you.
			</p>

			<h2>Third parties we rely on</h2>
			<ul>
				<li><strong>Firebase (Google)</strong> — authentication and account management.</li>
				<li><strong>Supabase</strong> — database storage for your business data.</li>
				<li><strong>Paddle</strong> — subscription billing and payment processing, acting as Merchant of Record for your purchase.</li>
				<li><strong>EmailJS</strong> — delivery of contact form messages.</li>
			</ul>
			<p>Each of these providers processes data under their own privacy policies in addition to this one.</p>

			<h2>Local storage &amp; cookies</h2>
			<p>
				We use browser local storage for things like your theme preference and which branch you're currently
				viewing — this stays on your device and isn't used for advertising or cross-site tracking.
			</p>

			<h2>Your data, your ownership</h2>
			<p>
				The business data you enter into Managify — inventory, sales, invoices, customer and supplier
				records — belongs to you. You can export most of it to PDF or Excel directly from the app at any
				time. To request a full export or deletion of your account and data, contact us using the details below.
			</p>

			<h2>Data retention</h2>
			<p>
				We keep your data for as long as your account is active. If you cancel your subscription, your data
				remains accessible for a reasonable period in case you resubscribe, after which it may be deleted on request.
			</p>

			<h2>Security</h2>
			<p>
				We use industry-standard practices to protect your data, including authenticated, per-account access
				controls. No system is perfectly secure, and we can't guarantee absolute security of information
				transmitted over the internet.
			</p>

			<h2>Children's privacy</h2>
			<p>Managify is a business tool and is not directed at, or knowingly used to collect data from, children.</p>

			<h2>Changes to this policy</h2>
			<p>We may update this policy from time to time. Material changes will update the date at the top of this page.</p>

			<h2>Contact us</h2>
			<p>
				Questions about this policy? Email <a href="mailto:nativeedge.studio@gmail.com">nativeedge.studio@gmail.com</a>{' '}
				or write to Plot 6/3 Sheet No 21, Model Colony, Karachi, Pakistan.
			</p>
		</LegalPageLayout>
	)
}
