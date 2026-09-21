import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, StoreInfo } from '../storage'
import { useAuth } from '../auth/useAuth'
import { useBranch } from '../auth/BranchContext'
import InvoiceHeaderDesigner from '../components/InvoiceHeaderDesigner'
import AccountSecurity from '../components/AccountSecurity'
import {
	PiStorefrontDuotone, PiPhoneDuotone, PiMapPinLineDuotone, PiEnvelopeSimpleDuotone,
	PiGlobeDuotone, PiIdentificationCardDuotone, PiCoinsDuotone, PiImageDuotone,
	PiPencilDuotone, PiCheckDuotone, PiXDuotone, PiUploadSimpleDuotone, PiPrinterDuotone,
	PiFileDuotone, PiRectangleDuotone, PiShoppingCartDuotone, PiReceiptDuotone,
	PiDeviceMobileCameraDuotone, PiTrashDuotone, PiBroomDuotone, PiSignOutDuotone,
	PiCheckCircleDuotone, PiWarningCircleDuotone, PiWarningDuotone,
	PiUserCircleDuotone, PiSlidersDuotone, PiUsersDuotone, PiBuildingsDuotone,
	PiArrowRightDuotone, PiUserPlusDuotone, PiShieldCheckDuotone,
} from 'react-icons/pi'

type SettingsSection = 'profile' | 'account' | 'invoices' | 'general' | 'staff'

const SECTIONS: { key: SettingsSection; label: string; icon: JSX.Element; ownerOnly?: boolean }[] = [
	{ key: 'profile', label: 'Profile', icon: <PiUserCircleDuotone size={16} /> },
	{ key: 'account', label: 'Account', icon: <PiShieldCheckDuotone size={16} />, ownerOnly: true },
	{ key: 'invoices', label: 'Invoices', icon: <PiReceiptDuotone size={16} /> },
	{ key: 'general', label: 'General', icon: <PiSlidersDuotone size={16} /> },
	{ key: 'staff', label: 'Staff', icon: <PiUsersDuotone size={16} />, ownerOnly: true },
]

const CURRENCIES: { code: string; label: string }[] = [
	{ code: 'PKR', label: 'PKR — Pakistani Rupee' },
	{ code: 'USD', label: 'USD — US Dollar' },
	{ code: 'EUR', label: 'EUR — Euro' },
	{ code: 'GBP', label: 'GBP — British Pound' },
	{ code: 'INR', label: 'INR — Indian Rupee' },
	{ code: 'AED', label: 'AED — UAE Dirham' },
	{ code: 'SAR', label: 'SAR — Saudi Riyal' },
]

const fieldLabelStyle = { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontWeight: 700, fontSize: 13, color: 'var(--text)' } as const

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (next: boolean) => void; label: string; description?: string }) {
	return (
		<div style={{ marginBottom: 8 }}>
			<label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
				<div
					role="switch"
					aria-checked={checked}
					onClick={() => onChange(!checked)}
					style={{
						width: 44, height: 24, borderRadius: 12,
						background: checked ? 'var(--accent)' : 'var(--border-strong)',
						position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
					}}
				>
					<div style={{
						position: 'absolute', top: 3, left: checked ? 23 : 3,
						width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s',
					}} />
				</div>
				<span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
			</label>
			{description && <p style={{ margin: '8px 0 0 56px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>{description}</p>}
		</div>
	)
}

export default function SettingsPage() {
	const defaultStoreInfo: StoreInfo = {
		storeName: 'Managify',
		phone: '',
		address: '',
		email: '',
		website: '',
		taxNumber: '',
		logo: '',
		currency: 'PKR'
	}
	const [storeInfo, setStoreInfo] = useState<StoreInfo>(defaultStoreInfo)
	// Last-SAVED store info, kept separate from the live-editing `storeInfo`
	// draft above. The Invoice Header Designer merges its layout against
	// whatever storeInfo it's given every time a field changes — if it were
	// fed the draft directly, every keystroke while editing Store Info would
	// re-run that merge (including on empty intermediate values while
	// clearing a field to retype it), corrupting the header layout mid-edit.
	const [savedInfo, setSavedInfo] = useState<StoreInfo>(defaultStoreInfo)
	const [isEditing, setIsEditing] = useState(false)
	const [formError, setFormError] = useState('')
	const [message, setMessage] = useState('')
	const [printSize, setPrintSize] = useState(() => {
		const saved = localStorage.getItem('printSize')
		if (saved) return saved
		return localStorage.getItem('thermalPrinting') === 'true' ? '80mm' : 'A4'
	})
	const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>(() => {
		return (localStorage.getItem('printOrientation') as 'portrait' | 'landscape') || 'portrait'
	})
	const [ecommerceMode, setEcommerceMode] = useState(() => {
		return localStorage.getItem('ecommerceMode') === 'true'
	})
	const [periodBilling, setPeriodBilling] = useState(() => {
		return localStorage.getItem('periodBilling') === 'true'
	})
	const [mobilePOS, setMobilePOS] = useState(() => {
		return localStorage.getItem('mobilePOS') === 'true'
	})
	const [showCashPaidLabel, setShowCashPaidLabel] = useState(() => {
		return localStorage.getItem('showCashPaidLabel') !== 'false'
	})
	const [showPromoFooter, setShowPromoFooter] = useState(() => {
		return localStorage.getItem('showPromoFooter') !== 'false'
	})
	const [resetModalOpen, setResetModalOpen] = useState(false)
	const [resetConfirmText, setResetConfirmText] = useState('')
	const [resetting, setResetting] = useState(false)
	const [clearStorageModalOpen, setClearStorageModalOpen] = useState(false)
	const [clearingStorage, setClearingStorage] = useState(false)
	const [section, setSection] = useState<SettingsSection>('profile')
	const { logout } = useAuth()
	const { branches, role } = useBranch()
	const navigate = useNavigate()
	const visibleSections = SECTIONS.filter(s => !s.ownerOnly || role === 'owner')

	useEffect(() => {
		const loadStoreInfo = async () => {
			try {
				const info = await db.getStoreInfo()
				setStoreInfo(info)
				setSavedInfo(info)
			} catch (error) {
				console.error('Error loading store info:', error)
			}
		}
		loadStoreInfo()
	}, [])

	function notify(text: string) {
		setMessage(text)
		setTimeout(() => setMessage(''), 3000)
	}

	const handleSave = async () => {
		setFormError('')
		if (!storeInfo.storeName?.trim()) { setFormError('Store name is required.'); return }
		if (!storeInfo.phone?.trim()) { setFormError('Phone number is required.'); return }
		if (!storeInfo.address?.trim()) { setFormError('Address is required.'); return }
		try {
			await db.updateStoreInfo(storeInfo)
			setSavedInfo(storeInfo)
			setIsEditing(false)
			notify('Store information saved successfully!')
		} catch (error) {
			notify('Error saving store information')
		}
	}

	const handleCancel = async () => {
		try {
			const info = await db.getStoreInfo()
			setStoreInfo(info)
			setSavedInfo(info)
			setIsEditing(false)
			setFormError('')
			setMessage('')
		} catch (error) {
			console.error('Error loading store info:', error)
		}
	}

	const handleChange = (field: keyof StoreInfo, value: string) => {
		setStoreInfo(prev => ({ ...prev, [field]: value }))
	}

	const handleLogout = async () => {
		try {
			await logout()
			navigate('/login')
		} catch (error) {
			console.error('Logout failed:', error)
		}
	}

	async function performReset() {
		setResetting(true)
		try {
			notify('Resetting system…')
			await db.clearAllData()
			// Clear any locally cached data (UI prefs are preserved)
			const preserved: Record<string, string | null> = {
				printSize: localStorage.getItem('printSize'),
				printOrientation: localStorage.getItem('printOrientation'),
				thermalPrinting: localStorage.getItem('thermalPrinting'),
				ecommerceMode: localStorage.getItem('ecommerceMode'),
				periodBilling: localStorage.getItem('periodBilling'),
				mobilePOS: localStorage.getItem('mobilePOS'),
				showCashPaidLabel: localStorage.getItem('showCashPaidLabel'),
				showPromoFooter: localStorage.getItem('showPromoFooter'),
			}
			localStorage.clear()
			Object.entries(preserved).forEach(([k, v]) => { if (v !== null) localStorage.setItem(k, v) })
			setResetModalOpen(false)
			notify('System reset successfully! All data has been cleared.')
			setTimeout(() => window.location.reload(), 2000)
		} catch (error: any) {
			console.error('Reset failed:', error)
			notify(`Error resetting system: ${error?.message || 'Please try again.'}`)
		} finally {
			setResetting(false)
		}
	}

	async function performClearStorage() {
		setClearingStorage(true)
		try {
			notify('Clearing internal storage…')

			// Preserve print + mode settings
			const printSizeSetting = localStorage.getItem('printSize')
			const printOrientationSetting = localStorage.getItem('printOrientation')
			const thermalPrintingSetting = localStorage.getItem('thermalPrinting')
			const ecommerceModeSetting = localStorage.getItem('ecommerceMode')
			const periodBillingSetting = localStorage.getItem('periodBilling')
			const mobilePOSSetting = localStorage.getItem('mobilePOS')
			const showCashPaidLabelSetting = localStorage.getItem('showCashPaidLabel')
			const showPromoFooterSetting = localStorage.getItem('showPromoFooter')

			localStorage.clear()

			if (printSizeSetting) localStorage.setItem('printSize', printSizeSetting)
			if (printOrientationSetting) localStorage.setItem('printOrientation', printOrientationSetting)
			if (thermalPrintingSetting) localStorage.setItem('thermalPrinting', thermalPrintingSetting)
			if (ecommerceModeSetting) localStorage.setItem('ecommerceMode', ecommerceModeSetting)
			if (periodBillingSetting) localStorage.setItem('periodBilling', periodBillingSetting)
			if (mobilePOSSetting) localStorage.setItem('mobilePOS', mobilePOSSetting)
			if (showCashPaidLabelSetting) localStorage.setItem('showCashPaidLabel', showCashPaidLabelSetting)
			if (showPromoFooterSetting) localStorage.setItem('showPromoFooter', showPromoFooterSetting)

			sessionStorage.clear()

			if ('indexedDB' in window) {
				try {
					const databases = await indexedDB.databases()
					for (const database of databases) {
						if (database.name) indexedDB.deleteDatabase(database.name)
					}
				} catch (e) {
					console.warn('Could not clear IndexedDB:', e)
				}
			}

			if ('caches' in window) {
				try {
					const cacheNames = await caches.keys()
					await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
				} catch (e) {
					console.warn('Could not clear caches:', e)
				}
			}

			setClearStorageModalOpen(false)
			notify('Internal storage cleared successfully! The page will reload to apply changes.')
			setTimeout(() => window.location.reload(), 2000)
		} catch (error) {
			console.error('Clear storage failed:', error)
			notify('Error clearing internal storage. Please try again.')
		} finally {
			setClearingStorage(false)
		}
	}

	const isError = message.toLowerCase().includes('error')

	return (
		<div>
			{/* ── Header ── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
				<div>
					<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Settings</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>Store profile, login &amp; password, invoice formatting, feature toggles, and system data</p>
				</div>
			</div>

			{/* ── Section tabs ── */}
			<div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
				{visibleSections.map(s => (
					<button
						key={s.key}
						onClick={() => setSection(s.key)}
						style={{
							display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', marginBottom: -1,
							background: 'transparent', border: 'none',
							borderBottom: section === s.key ? '2px solid var(--accent)' : '2px solid transparent',
							color: section === s.key ? 'var(--accent)' : 'var(--text-muted)',
							fontWeight: section === s.key ? 700 : 500, fontSize: 13.5, cursor: 'pointer',
						}}
					>{s.icon} {s.label}</button>
				))}
			</div>

			{section === 'profile' && (
			<>
			{/* ── Store Information ── */}
			<div className="card">
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
					<div>
						<h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700 }}>Store Information</h3>
						<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Appears on every invoice, receipt, and report.</p>
					</div>
					<div style={{ display: 'flex', gap: 8 }}>
						{!isEditing ? (
							<button onClick={() => setIsEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
								<PiPencilDuotone size={15} /> Edit Store Info
							</button>
						) : (
							<>
								<button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
									<PiCheckDuotone size={15} /> Save Changes
								</button>
								<button className="secondary" onClick={handleCancel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
									<PiXDuotone size={15} /> Cancel
								</button>
							</>
						)}
					</div>
				</div>

				{formError && (
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, color: 'var(--danger)', fontSize: 13 }}>
						<PiWarningCircleDuotone size={15} /> {formError}
					</div>
				)}

				<div className="form-grid" style={{ marginTop: 20 }}>
					<div>
						<label style={fieldLabelStyle}><PiStorefrontDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Store Name *</label>
						<input
							type="text"
							value={storeInfo.storeName || ''}
							onChange={(e) => handleChange('storeName', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter store name"
						/>
					</div>

					<div>
						<label style={fieldLabelStyle}><PiPhoneDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Phone Number *</label>
						<input
							type="tel"
							value={storeInfo.phone || ''}
							onChange={(e) => handleChange('phone', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter phone number"
						/>
					</div>

					<div style={{ gridColumn: '1 / -1' }}>
						<label style={fieldLabelStyle}><PiMapPinLineDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Address *</label>
						<textarea
							value={storeInfo.address || ''}
							onChange={(e) => handleChange('address', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter complete store address"
							style={{
								background: 'var(--bg-sunken)',
								border: '1px solid var(--border-strong)',
								color: 'var(--text)',
								padding: '8px 10px',
								borderRadius: '8px',
								width: '100%',
								minHeight: '80px',
								resize: 'vertical',
								fontFamily: 'inherit'
							}}
						/>
					</div>

					<div>
						<label style={fieldLabelStyle}><PiEnvelopeSimpleDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Email Address</label>
						<input
							type="email"
							value={storeInfo.email || ''}
							onChange={(e) => handleChange('email', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter email address"
						/>
					</div>

					<div>
						<label style={fieldLabelStyle}><PiGlobeDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Website</label>
						<input
							type="url"
							value={storeInfo.website || ''}
							onChange={(e) => handleChange('website', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter website URL"
						/>
					</div>

					<div>
						<label style={fieldLabelStyle}><PiIdentificationCardDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Tax Number</label>
						<input
							type="text"
							value={storeInfo.taxNumber || ''}
							onChange={(e) => handleChange('taxNumber', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter tax registration number"
						/>
					</div>

					<div>
						<label style={fieldLabelStyle}><PiCoinsDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Currency</label>
						<select
							value={storeInfo.currency || 'PKR'}
							onChange={(e) => handleChange('currency', e.target.value)}
							disabled={!isEditing}
							style={{
								background: 'var(--bg-sunken)',
								border: '1px solid var(--border-strong)',
								color: 'var(--text)',
								padding: '8px 10px',
								borderRadius: '8px',
								width: '100%',
								fontFamily: 'inherit',
								cursor: isEditing ? 'pointer' : 'not-allowed'
							}}
						>
							{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
						</select>
					</div>

					<div>
						<label style={fieldLabelStyle}><PiImageDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Logo</label>
						<input
							type="url"
							value={storeInfo.logo || ''}
							onChange={(e) => handleChange('logo', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter logo image URL"
							style={{ marginBottom: 8 }}
						/>
						{isEditing && (
							<label className="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', cursor: 'pointer', color: 'var(--text-muted)' }}>
								<PiUploadSimpleDuotone size={14} /> Upload image
								<input
									type="file"
									accept="image/*"
									onChange={(e) => {
										const file = e.target.files?.[0]
										if (file) {
											const reader = new FileReader()
											reader.onload = (event) => {
												const result = event.target?.result as string
												handleChange('logo', result)
											}
											reader.readAsDataURL(file)
										}
									}}
									style={{ display: 'none' }}
								/>
							</label>
						)}
					</div>
				</div>

				{storeInfo.logo && (
					<div style={{ marginTop: 20 }}>
						<label style={fieldLabelStyle}>Logo Preview</label>
						<div style={{
							display: 'flex',
							alignItems: 'center',
							gap: 12,
							padding: 12,
							background: 'var(--bg-elevated)',
							border: '1px solid var(--border)',
							borderRadius: 8
						}}>
							<img
								src={storeInfo.logo}
								alt="Store Logo"
								style={{ maxHeight: 60, maxWidth: 120, objectFit: 'contain' }}
								onError={(e) => { e.currentTarget.style.display = 'none' }}
							/>
							<span style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>{storeInfo.storeName} Logo</span>
						</div>
					</div>
				)}
			</div>
			</>
			)}

			{section === 'account' && role === 'owner' && (
				<AccountSecurity onNotify={notify} />
			)}

			{section === 'invoices' && (
			<>
			{/* ── Invoice Header Designer ── */}
			<div className="card">
				<div style={{ marginBottom: 16 }}>
					<h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700 }}>Invoice Header Designer</h3>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
						Drag, resize and arrange your logo and store info. Click <strong>Save Layout</strong> to apply it to all printed invoices.
					</p>
				</div>
				<InvoiceHeaderDesigner
					storeInfo={savedInfo}
					headerLayout={savedInfo.headerLayout}
					onSave={async (json) => {
						await db.updateHeaderLayout(json)
						setSavedInfo(prev => ({ ...prev, headerLayout: json }))
						setStoreInfo(prev => ({ ...prev, headerLayout: json }))
						notify('Header layout saved to database!')
					}}
				/>
			</div>

			{/* ── Printing Settings ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700 }}>Printing Settings</h3>
				<div style={{ marginBottom: 20 }}>
					<label style={fieldLabelStyle}><PiPrinterDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Bill Print Size</label>
					<select
						value={printSize}
						onChange={(e) => {
							const val = e.target.value
							setPrintSize(val)
							localStorage.setItem('printSize', val)
							localStorage.setItem('thermalPrinting', (val === '58mm' || val === '80mm').toString())
							const labels: Record<string, string> = {
								'A4': 'A4 – Full page',
								'A5': 'A5 – Half page',
								'80mm': '80mm – Standard thermal receipt',
								'58mm': '58mm – Small thermal receipt',
							}
							notify('Print size set to ' + (labels[val] || val) + '. All bills will use this format.')
						}}
						style={{
							background: 'var(--bg-sunken)',
							border: '1px solid var(--border-strong)',
							color: 'var(--text)',
							padding: '8px 10px',
							borderRadius: 8,
							width: '100%',
							maxWidth: 320,
							fontFamily: 'inherit',
							cursor: 'pointer'
						}}
					>
						<option value="A4">A4 – Full page (standard)</option>
						<option value="A5">A5 – Half page</option>
						<option value="80mm">80mm – Standard thermal receipt</option>
						<option value="58mm">58mm – Small thermal receipt</option>
					</select>
					<p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: 13.5 }}>
						Choose the paper size for printing bills and invoices. Thermal sizes (58mm / 80mm) use a compact single-column receipt layout.
					</p>
				</div>

				{(printSize === 'A4' || printSize === 'A5') && (
					<div>
						<label style={fieldLabelStyle}>{printSize} Orientation</label>
						<div style={{ display: 'flex', gap: 10 }}>
							{([
								{ value: 'portrait' as const, icon: <PiFileDuotone size={15} /> },
								{ value: 'landscape' as const, icon: <PiRectangleDuotone size={15} /> },
							]).map(({ value, icon }) => (
								<button
									key={value}
									type="button"
									onClick={() => {
										setPrintOrientation(value)
										localStorage.setItem('printOrientation', value)
										notify(`${printSize} orientation set to ${value}.`)
									}}
									style={{
										display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, border: '1px solid', fontSize: 13,
										background: printOrientation === value ? 'color-mix(in srgb, var(--accent) 14%, var(--bg-elevated))' : 'transparent',
										color: printOrientation === value ? 'var(--accent)' : 'var(--text-muted)',
										borderColor: printOrientation === value ? 'var(--accent)' : 'var(--border-strong)',
										cursor: 'pointer', fontWeight: printOrientation === value ? 700 : 500, textTransform: 'capitalize',
									}}
								>{icon} {value}</button>
							))}
						</div>
						<p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: 13.5 }}>
							{printSize === 'A5'
								? 'Portrait: 148 × 210 mm. Landscape: 210 × 148 mm.'
								: 'Portrait: 210 × 297 mm. Landscape: 297 × 210 mm.'}
						</p>
					</div>
				)}
			</div>

			{/* ── Billing Settings ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
					<PiReceiptDuotone size={16} style={{ color: 'var(--text-muted)' }} /> Billing Settings
				</h3>
				<Toggle
					checked={periodBilling}
					onChange={(next) => {
						setPeriodBilling(next)
						localStorage.setItem('periodBilling', next.toString())
						notify('Period-based billing ' + (next ? 'enabled' : 'disabled') + '. Service period fields are now ' + (next ? 'visible' : 'hidden') + ' on billing.')
					}}
					label="Enable Period-Based Billing"
					description="When enabled, a service period (from / to date) field appears on the Billing page and prints on the invoice. Useful for monthly service or subscription invoices."
				/>
				<Toggle
					checked={showCashPaidLabel}
					onChange={(next) => {
						setShowCashPaidLabel(next)
						localStorage.setItem('showCashPaidLabel', next.toString())
						notify('"Cash - Paid in Full" label ' + (next ? 'enabled' : 'disabled') + ' on invoices.')
					}}
					label='Show "Cash - Paid in Full" on Invoices'
					description="When enabled, cash sale invoices show a “Cash - Paid in Full” / amount-paid section. When disabled, cash invoices print without that section for a simpler layout."
				/>
				<Toggle
					checked={showPromoFooter}
					onChange={(next) => {
						setShowPromoFooter(next)
						localStorage.setItem('showPromoFooter', next.toString())
						notify('Promotional footer ' + (next ? 'enabled' : 'disabled') + ' on invoices.')
					}}
					label="Show Promotional Footer on Invoices"
					description='When enabled, invoices show the Managify and NativeEdge Studio logos plus a "Want this POS system?" contact line at the bottom. When disabled, that branding and promotional content is removed — only "Thank you for your business" and your store’s own contact info remain.'
				/>
			</div>
			</>
			)}

			{section === 'general' && (
			<>
			{/* ── E-commerce Settings ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
					<PiShoppingCartDuotone size={16} style={{ color: 'var(--text-muted)' }} /> E-commerce Settings
				</h3>
				<Toggle
					checked={ecommerceMode}
					onChange={(next) => {
						setEcommerceMode(next)
						localStorage.setItem('ecommerceMode', next.toString())
						notify('E-commerce mode ' + (next ? 'enabled' : 'disabled') + '. Customer address field is now ' + (next ? 'visible' : 'hidden') + ' on billing.')
					}}
					label="Enable E-commerce Mode"
					description="When enabled, a customer delivery address field appears on the Billing page and prints on the invoice."
				/>
			</div>

			{/* ── Mobile Phone POS ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
					<PiDeviceMobileCameraDuotone size={16} style={{ color: 'var(--text-muted)' }} /> Mobile Phone POS
				</h3>
				<Toggle
					checked={mobilePOS}
					onChange={(next) => {
						setMobilePOS(next)
						localStorage.setItem('mobilePOS', next.toString())
						notify('Mobile Phone POS ' + (next ? 'enabled' : 'disabled') + '. IMEI tracking is now ' + (next ? 'active' : 'inactive') + ' on purchases.')
					}}
					label="Enable Mobile Phone POS Mode"
					description='When enabled, a "Mobile Phone Purchase" checkbox appears on the Purchases page. Checking it reveals IMEI number fields (2 per unit) that are saved to the database for inventory tracking.'
				/>
			</div>

			{/* ── System Management (danger zone) ── */}
			<div className="card" style={{ border: '1px solid color-mix(in srgb, var(--danger) 35%, var(--border-strong))' }}>
				<h3 style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>
					<PiWarningDuotone size={16} /> System Management
				</h3>
				<p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: 13.5 }}>
					Dangerous operations that affect the entire system.
				</p>
				<div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8 }}>
					<h4 style={{ margin: '0 0 6px 0', color: 'var(--text)', fontSize: 13.5 }}>Clear Internal Storage</h4>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
						Clears browser cache, localStorage, and cached data. Your business data (items, sales, purchases) will remain safe in the cloud.
					</p>
				</div>
				<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
					<button onClick={() => setResetModalOpen(true)} style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
						<PiTrashDuotone size={15} /> Reset System
					</button>
					<button className="secondary" onClick={() => setClearStorageModalOpen(true)} style={{ color: 'var(--warning)', borderColor: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
						<PiBroomDuotone size={15} /> Clear Internal Storage
					</button>
					<button className="secondary" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
						<PiSignOutDuotone size={15} /> Logout
					</button>
				</div>
			</div>
			</>
			)}

			{section === 'staff' && role === 'owner' && (
			<>
			{/* ── Branches ── */}
			<div className="card">
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
					<div>
						<h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
							<PiBuildingsDuotone size={16} style={{ color: 'var(--text-muted)' }} /> Branches
						</h3>
						<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
							{branches.length} location{branches.length === 1 ? '' : 's'} on record.
						</p>
					</div>
					<button className="secondary" onClick={() => navigate('/branches')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						Manage Branches <PiArrowRightDuotone size={14} />
					</button>
				</div>
			</div>

			{/* ── Staff accounts ── */}
			<div className="card">
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
					<div>
						<h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
							<PiUserPlusDuotone size={16} style={{ color: 'var(--text-muted)' }} /> Staff Accounts
						</h3>
						<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
							Invite a manager or staff member with their own login, scoped to one branch.
						</p>
					</div>
					<button className="secondary" onClick={() => navigate('/staff')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						Manage Staff <PiArrowRightDuotone size={14} />
					</button>
				</div>
			</div>
			</>
			)}

			{/* ── Toast ── */}
			{message && (
				<div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 500, maxWidth: 380, boxShadow: '0 8px 24px var(--overlay)', background: isError ? 'var(--danger-bg)' : 'var(--success-bg)', color: isError ? 'var(--danger)' : 'var(--success)', border: `1px solid ${isError ? 'var(--danger)' : 'var(--success)'}` }}>
					{isError ? <PiWarningCircleDuotone size={17} style={{ flexShrink: 0 }} /> : <PiCheckCircleDuotone size={17} style={{ flexShrink: 0 }} />}
					{message}
				</div>
			)}

			{/* ── Reset system modal ── */}
			{resetModalOpen && (
				<div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
					onClick={() => { if (!resetting) { setResetModalOpen(false); setResetConfirmText('') } }}
				>
					<div className="card" style={{ maxWidth: 420, width: '100%', marginBottom: 0 }} onClick={e => e.stopPropagation()}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
							<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', flexShrink: 0 }}>
								<PiWarningDuotone size={17} />
							</span>
							<h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Reset the entire system?</h3>
						</div>
						<p style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
							This permanently deletes <strong>all</strong> items, purchases, sales, vendors, expenses, employees, assets, and invoices. This cannot be undone.
						</p>
						<label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
							Type <strong style={{ color: 'var(--danger)' }}>RESET</strong> to confirm
						</label>
						<input
							value={resetConfirmText}
							onChange={e => setResetConfirmText(e.target.value)}
							placeholder="RESET"
							disabled={resetting}
							style={{ marginBottom: 16 }}
						/>
						<div className="form-actions">
							<button className="secondary" onClick={() => { setResetModalOpen(false); setResetConfirmText('') }} disabled={resetting}>Cancel</button>
							<button
								onClick={performReset}
								disabled={resetting || resetConfirmText.trim().toUpperCase() !== 'RESET'}
								style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6, opacity: resetConfirmText.trim().toUpperCase() !== 'RESET' ? 0.5 : 1, cursor: resetConfirmText.trim().toUpperCase() !== 'RESET' ? 'not-allowed' : 'pointer' }}
							>
								<PiTrashDuotone size={15} /> {resetting ? 'Resetting…' : 'Reset Everything'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ── Clear internal storage modal ── */}
			{clearStorageModalOpen && (
				<div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
					onClick={() => !clearingStorage && setClearStorageModalOpen(false)}
				>
					<div className="card" style={{ maxWidth: 400, width: '100%', marginBottom: 0 }} onClick={e => e.stopPropagation()}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
							<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--warning-bg)', color: 'var(--warning)', flexShrink: 0 }}>
								<PiBroomDuotone size={17} />
							</span>
							<h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Clear internal storage?</h3>
						</div>
						<p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
							This clears browser cache, local storage, and cached data on this device. Your business data stays safe in the cloud.
						</p>
						<div className="form-actions">
							<button className="secondary" onClick={() => setClearStorageModalOpen(false)} disabled={clearingStorage}>Cancel</button>
							<button onClick={performClearStorage} disabled={clearingStorage} style={{ background: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
								<PiBroomDuotone size={15} /> {clearingStorage ? 'Clearing…' : 'Clear Storage'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
