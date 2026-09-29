import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { formatCurrency } from '../utils/currency'
import { PiXDuotone, PiPrinterDuotone, PiDownloadSimpleDuotone, PiWarningCircleDuotone } from 'react-icons/pi'

export default function BarcodeLabelModal({ item, currency, onClose }: {
	item: { sku: string; name: string; price: number }
	currency: string
	onClose: () => void
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [copies, setCopies] = useState(1)
	const [renderError, setRenderError] = useState('')

	useEffect(() => {
		if (!canvasRef.current) return
		try {
			JsBarcode(canvasRef.current, item.sku, { format: 'CODE128', width: 2, height: 60, displayValue: true, fontSize: 14, margin: 8 })
			setRenderError('')
		} catch {
			setRenderError('This SKU has characters a barcode can\'t encode. Try letters, numbers, and dashes only.')
		}
	}, [item.sku])

	function handleDownload() {
		const dataUrl = canvasRef.current?.toDataURL('image/png')
		if (!dataUrl) return
		const a = document.createElement('a')
		a.href = dataUrl
		a.download = `${item.sku}-barcode.png`
		a.click()
	}

	function handlePrint() {
		const dataUrl = canvasRef.current?.toDataURL('image/png')
		if (!dataUrl) return
		const win = window.open('', '_blank', 'width=420,height=600')
		if (!win) return
		const label = `
			<div class="label">
				<img src="${dataUrl}" />
				<div class="name">${item.name}</div>
				<div class="price">${formatCurrency(item.price, currency)}</div>
			</div>`
		win.document.write(`<!DOCTYPE html><html><head><title>${item.sku}</title><style>
			body { margin: 0; font-family: system-ui, sans-serif; }
			.label { width: 240px; padding: 10px 0; text-align: center; page-break-inside: avoid; }
			.label img { max-width: 100%; }
			.name { font-size: 12px; font-weight: 600; margin-top: 2px; }
			.price { font-size: 12px; color: #444; }
			@media print { .label { break-inside: avoid; } }
		</style></head><body>${label.repeat(Math.max(1, copies))}</body></html>`)
		win.document.close()
		win.focus()
		setTimeout(() => win.print(), 300)
	}

	return (
		<div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
			<div className="card" style={{ maxWidth: 360, width: '100%', marginBottom: 0, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
					<h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Barcode — {item.sku}</h3>
					<button className="secondary" onClick={onClose} style={{ display: 'flex', padding: 6 }} aria-label="Close"><PiXDuotone size={14} /></button>
				</div>

				{renderError ? (
					<div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '0 0 14px', color: 'var(--danger)', fontSize: 13, textAlign: 'left' }}>
						<PiWarningCircleDuotone size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{renderError}</span>
					</div>
				) : (
					<div style={{ background: '#fff', borderRadius: 8, padding: 12, marginBottom: 14 }}>
						<canvas ref={canvasRef} style={{ maxWidth: '100%' }} />
						<div style={{ fontSize: 12, fontWeight: 600, color: '#111', marginTop: 4 }}>{item.name}</div>
					</div>
				)}

				<label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
					Copies
					<input
						type="number" min={1} max={100} value={copies}
						onChange={e => setCopies(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
						style={{ width: 60, textAlign: 'center' }}
					/>
				</label>

				<div className="form-actions" style={{ justifyContent: 'center' }}>
					<button className="secondary" onClick={handleDownload} disabled={!!renderError} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<PiDownloadSimpleDuotone size={15} /> Download PNG
					</button>
					<button onClick={handlePrint} disabled={!!renderError} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<PiPrinterDuotone size={15} /> Print
					</button>
				</div>
			</div>
		</div>
	)
}
