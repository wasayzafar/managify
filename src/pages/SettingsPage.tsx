import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, StoreInfo } from '../storage'
import { useAuth } from '../auth/useAuth'

export default function SettingsPage() {
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({
		storeName: 'Managify',
		phone: '',
		address: '',
		email: '',
		website: '',
		taxNumber: '',
		logo: ''
	})
	const [isEditing, setIsEditing] = useState(false)
	const [message, setMessage] = useState('')
	const { logout } = useAuth()
	const navigate = useNavigate()

	useEffect(() => {
		const loadStoreInfo = async () => {
			try {
				const info = await db.getStoreInfo()
				setStoreInfo(info)
			} catch (error) {
				console.error('Error loading store info:', error)
			}
		}
		loadStoreInfo()
	}, [])

	const handleSave = async () => {
		try {
			await db.updateStoreInfo(storeInfo)
			setIsEditing(false)
			setMessage('Store information saved successfully!')
			setTimeout(() => setMessage(''), 3000)
		} catch (error) {
			setMessage('Error saving store information')
			setTimeout(() => setMessage(''), 3000)
		}
	}

	const handleCancel = async () => {
		try {
			const info = await db.getStoreInfo()
			setStoreInfo(info)
			setIsEditing(false)
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

	const handleResetSystem = async () => {
		if (window.confirm('⚠️ WARNING: This will permanently delete ALL data including items, purchases, sales, and settings. This action cannot be undone. Are you sure?')) {
			if (window.confirm('This is your final confirmation. All data will be lost forever. Continue?')) {
				try {
					setMessage('Resetting system...')
					await db.clearAllData()
					setMessage('System reset successfully! All data has been cleared.')
					setTimeout(() => {
						window.location.reload()
					}, 2000)
				} catch (error) {
					setMessage('Error resetting system. Please try again.')
					console.error('Reset failed:', error)
				}
			}
		}
	}

	return (
		<div>
			<div className="card" style={{ marginBottom: '24px' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
					<h1 style={{ margin: '0', fontSize: '28px' }}>Store Settings</h1>
					<div style={{ display: 'flex', gap: '10px' }}>
						{!isEditing ? (
							<button onClick={() => setIsEditing(true)}>Edit Store Info</button>
						) : (
							<>
								<button onClick={handleSave}>Save Changes</button>
								<button className="secondary" onClick={handleCancel}>Cancel</button>
							</>
						)}
					</div>
				</div>
				{message && (
					<div style={{ 
						padding: '12px', 
						background: message.includes('Error') ? '#f44336' : '#4caf50', 
						color: 'white', 
						borderRadius: '8px', 
						marginBottom: '16px' 
					}}>
						{message}
					</div>
				)}
				<p style={{ margin: '0', color: '#8b949e' }}>
					Manage your store information that will appear on all invoices and reports.
				</p>
			</div>

			<div className="card">
				<h3 style={{ margin: '0 0 20px 0' }}>Store Information</h3>
				
				<div className="form-grid">
					<div>
						<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
							Store Name *
						</label>
						<input
							type="text"
							value={storeInfo.storeName}
							onChange={(e) => handleChange('storeName', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter store name"
						/>
					</div>

					<div>
						<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
							Phone Number *
						</label>
						<input
							type="tel"
							value={storeInfo.phone}
							onChange={(e) => handleChange('phone', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter phone number"
						/>
					</div>

					<div style={{ gridColumn: '1 / -1' }}>
						<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
							Address *
						</label>
						<textarea
							value={storeInfo.address}
							onChange={(e) => handleChange('address', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter complete store address"
							style={{
								background: '#0b0f14',
								border: '1px solid #243245',
								color: '#e8eef5',
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
						<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
							Email Address
						</label>
						<input
							type="email"
							value={storeInfo.email}
							onChange={(e) => handleChange('email', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter email address"
						/>
					</div>

					<div>
						<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
							Website
						</label>
						<input
							type="url"
							value={storeInfo.website}
							onChange={(e) => handleChange('website', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter website URL"
						/>
					</div>

					<div>
						<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
							Tax Number
						</label>
						<input
							type="text"
							value={storeInfo.taxNumber}
							onChange={(e) => handleChange('taxNumber', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter tax registration number"
						/>
					</div>

					<div>
						<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
							Logo
						</label>
						<input
							type="url"
							value={storeInfo.logo}
							onChange={(e) => handleChange('logo', e.target.value)}
							disabled={!isEditing}
							placeholder="Enter logo image URL"
							style={{ marginBottom: '8px' }}
						/>
						{isEditing && (
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
								style={{ fontSize: '14px' }}
							/>
						)}
					</div>
				</div>

				{storeInfo.logo && (
					<div style={{ marginTop: '20px' }}>
						<label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
							Logo Preview
						</label>
						<div style={{ 
							display: 'flex', 
							alignItems: 'center', 
							gap: '12px',
							padding: '12px',
							background: '#0f141b',
							border: '1px solid #1f2a36',
							borderRadius: '8px'
						}}>
							<img 
								src={storeInfo.logo} 
								alt="Store Logo" 
								style={{ 
									maxHeight: '60px', 
									maxWidth: '120px', 
									objectFit: 'contain' 
								}}
								onError={(e) => {
									e.currentTarget.style.display = 'none'
								}}
							/>
							<span style={{ color: '#8b949e', fontSize: '14px' }}>
								{storeInfo.storeName} Logo
							</span>
						</div>
					</div>
				)}
			</div>

			<div className="card">
				<h3 style={{ margin: '0 0 16px 0' }}>Invoice Preview</h3>
				<p style={{ margin: '0 0 16px 0', color: '#8b949e' }}>
					This is how your store information will appear on invoices and reports.
				</p>
				
				<div style={{ 
					fontFamily: 'Arial, sans-serif', 
					maxWidth: '600px', 
					margin: '0 auto', 
					padding: '20px', 
					background: 'white', 
					color: 'black',
					border: '1px solid #ddd',
					borderRadius: '8px'
				}}>
					<div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
						{storeInfo.logo && (
							<img 
								src={storeInfo.logo} 
								alt="Store Logo" 
								style={{ 
									maxHeight: '60px', 
									maxWidth: '120px', 
									objectFit: 'contain',
									marginBottom: '10px'
								}}
								onError={(e) => {
									e.currentTarget.style.display = 'none'
								}}
							/>
						)}
						<h1 style={{ margin: '0', fontSize: '28px', color: '#333' }}>
							{(storeInfo.storeName || 'MANAGIFY').toUpperCase()}
						</h1>
						{storeInfo.address && (
							<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
								{storeInfo.address}
							</p>
						)}
						{storeInfo.phone && (
							<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
								Phone: {storeInfo.phone}
							</p>
						)}
						{storeInfo.email && (
							<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
								Email: {storeInfo.email}
							</p>
						)}
						{storeInfo.website && (
							<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
								Website: {storeInfo.website}
							</p>
						)}
						{storeInfo.taxNumber && (
							<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
								Tax #: {storeInfo.taxNumber}
							</p>
						)}
					</div>
					
					<div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
						<p>Sample Invoice Header</p>
					</div>
				</div>
			</div>

			<div className="card">
				<h3 style={{ margin: '0 0 16px 0' }}>System Management</h3>
				<p style={{ margin: '0 0 16px 0', color: '#8b949e' }}>
					Dangerous operations that affect the entire system.
				</p>
				<div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
					<button 
						onClick={handleResetSystem}
						style={{ 
							background: '#d32f2f', 
							color: 'white', 
							border: 'none', 
							padding: '10px 20px', 
							borderRadius: '8px', 
							cursor: 'pointer' 
						}}
					>
						🗑️ Reset System
					</button>
					<button 
						onClick={handleLogout}
						style={{ 
							background: '#f44336', 
							color: 'white', 
							border: 'none', 
							padding: '10px 20px', 
							borderRadius: '8px', 
							cursor: 'pointer' 
						}}
					>
						Logout
					</button>
				</div>
			</div>
		</div>
	)
}
