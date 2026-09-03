import { useRef, useEffect, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

export function useBarcodeScanner(onScan: (code: string) => void, enabled: boolean = true) {
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
	const [isScanning, setIsScanning] = useState(false)
	const [error, setError] = useState('')

	// The scan session is started once (see the effect below, keyed only on
	// `enabled`) and its decode callback is registered at that moment. Calling
	// `onScan` directly would freeze that closure for the whole session, so a
	// scan completed after the caller's state changed (e.g. the user typed
	// into other fields after opening the scanner) would fire a stale
	// callback and clobber that newer state. Route through a ref that's
	// always kept current instead.
	const onScanRef = useRef(onScan)
	useEffect(() => { onScanRef.current = onScan }, [onScan])

	const startScanning = async () => {
		if (!enabled) return
		
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
						onScanRef.current(result.getText())
					}
				})
			}
		} catch (e: any) {
			setError(e?.message || 'Camera access failed')
			setIsScanning(false)
		}
	}

	const stopScanning = () => {
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
		if (enabled) {
			startScanning()
		} else {
			stopScanning()
		}
		
		return () => stopScanning()
	}, [enabled])

	return {
		videoRef,
		isScanning,
		error,
		startScanning,
		stopScanning
	}
}