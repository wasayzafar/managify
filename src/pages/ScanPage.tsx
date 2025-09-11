import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'
import { db } from '../storage'

export default function ScanPage() {
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const inputRef = useRef<HTMLInputElement | null>(null)
	const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
	const [value, setValue] = useState('')
	const [error, setError] = useState('')
	const [autoAdd, setAutoAdd] = useState(true)
	const [info, setInfo] = useState('')
	const [isScanning, setIsScanning] = useState(false)
	const lastCreatedRef = useRef<string>('')
	const [editOpen, setEditOpen] = useState(false)
	const [editId, setEditId] = useState<string>('')
	const [editName, setEditName] = useState('')
	const [editPrice, setEditPrice] = useState('0')

	const processBarcode = (text: string) => {
		setValue(text)
		if (autoAdd && text && lastCreatedRef.current !== text) {
			const existing = db.getItemBySku(text)
			if (!existing) {
				const created = db.createItem({ sku: text, name: text, price: 0 })
				lastCreatedRef.current = text
				setInfo(`Item created with SKU ${text}`)
				setEditId(created.id)
				setEditName(created.name)
				setEditPrice(String(created.price))
				setEditOpen(true)
			} else {
				setInfo(`Item already exists: ${text}`)
			}
		}
	}

	const startCamera = async () => {
		try {
			setError('')
			setIsScanning(true)
			const codeReader = new BrowserMultiFormatReader()
			codeReaderRef.current = codeReader
			
			const constraints = {
				video: {
					facingMode: 'environment',
					width: { ideal: 1280 },
					height: { ideal: 720 }
				}
			}
			
			const stream = await navigator.mediaDevices.getUserMedia(constraints)
			if (videoRef.current) {
				videoRef.current.srcObject = stream
				await videoRef.current.play()
				
				codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
					if (result) {
						processBarcode(result.getText())
					}
				})
			}
		} catch (e: any) {
			setError(e?.message || 'Camera access failed')
			setIsScanning(false)
		}
	}

	const stopCamera = () => {
		if (codeReaderRef.current) {
			codeReaderRef.current.reset()
		}
		if (videoRef.current?.srcObject) {
			const stream = videoRef.current.srcObject as MediaStream
			stream.getTracks().forEach(track => track.stop())
			videoRef.current.srcObject = null
		}
		setIsScanning(false)
	}

	useEffect(() => {
		const handleKeyPress = (e: KeyboardEvent) => {
			if (e.target === inputRef.current && e.key === 'Enter') {
				processBarcode(value)
			}
		}
		document.addEventListener('keypress', handleKeyPress)
		return () => {
			document.removeEventListener('keypress', handleKeyPress)
			stopCamera()
		}
	}, [value, autoAdd])

	function saveDetails() {
		if (!editId) return
		const priceNum = Number(editPrice || '0')
		db.updateItem(editId, { name: editName || value, price: priceNum })
		setEditOpen(false)
		setInfo('Item details saved')
	}

	return (
		<div className="card">
			<h2>Barcode Scanner</h2>
			
			<div className="form-actions" style={{ marginBottom: 12 }}>
				{!isScanning ? (
					<button onClick={startCamera}>Start Camera</button>
				) : (
					<button onClick={stopCamera} className="secondary">Stop Camera</button>
				)}
			</div>
			
			{isScanning && (
				<video 
					ref={videoRef} 
					style={{ width: '100%', maxHeight: 320, background: '#111', borderRadius: 12 }} 
					muted 
					playsInline 
				/>
			)}
			
			<div className="form-grid" style={{ marginTop: 12 }}>
				<input 
					ref={inputRef}
					value={value} 
					onChange={e => setValue(e.target.value)} 
					placeholder="Scan barcode or type/paste here (press Enter)" 
					autoFocus
				/>
				<button onClick={() => processBarcode(value)} disabled={!value}>Process</button>
				<label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<input type="checkbox" checked={autoAdd} onChange={e => { setAutoAdd(e.target.checked); setInfo('') }} />
					Auto-create item on scan
				</label>
			</div>
			{info && <div className="badge">{info}</div>}
			{error && <div className="badge" style={{ background: '#ff4444' }}>{error}</div>}
			<p style={{ opacity: 0.8 }}>Use camera to scan barcodes or connect a barcode reader and scan directly into the input field. Press Enter or click Process to handle the barcode.</p>

			{editOpen && (
				<div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
					<div className="card" style={{ width: '100%', maxWidth: 480 }}>
						<h3>New Product Details</h3>
						<div className="form-grid">
							<input value={value} readOnly />
							<input placeholder="Name" value={editName} onChange={e => setEditName(e.target.value)} />
							<input placeholder="Price" type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
						</div>
						<div className="form-actions" style={{ marginTop: 12 }}>
							<button onClick={saveDetails}>Save</button>
							<button className="secondary" onClick={() => setEditOpen(false)}>Close</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
