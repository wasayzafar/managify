export const getPrintSize = (): string => {
  const printSize = localStorage.getItem('printSize')
  if (printSize) return printSize
  // backward compat
  if (localStorage.getItem('thermalPrinting') === 'true') return '80mm'
  return 'A4'
}

export const getPrintOrientation = (): 'portrait' | 'landscape' => {
  return (localStorage.getItem('printOrientation') as 'portrait' | 'landscape') || 'portrait'
}

export const isThermalPrinting = (): boolean => {
  const size = getPrintSize()
  return size === '58mm' || size === '80mm'
}

export const getThermalPrintStyles = () => {
  const size = getPrintSize()

  if (size === '58mm' || size === '80mm') {
    return {
      container: {
        fontFamily: 'monospace',
        width: '100%',
        maxWidth: size,
        margin: '0',
        padding: '2px',
        background: 'white',
        color: 'black',
        fontSize: size === '58mm' ? '9px' : '12px',
        lineHeight: '1.1'
      }
    }
  }

  const isLandscape = getPrintOrientation() === 'landscape'
  // Portrait: A4=210mm, A5=148mm — Landscape: A4=297mm, A5=210mm
  const maxWidth = size === 'A5'
    ? (isLandscape ? '210mm' : '148mm')
    : (isLandscape ? '297mm' : '210mm')

  return {
    container: {
      fontFamily: 'Arial, sans-serif',
      maxWidth,
      margin: '0 auto',
      padding: '10px',
      background: 'white',
      color: 'black'
    }
  }
}

export const getPrintWindowSize = (): { width: number; height: number } => {
  const size = getPrintSize()
  const isLandscape = getPrintOrientation() === 'landscape'
  if (size === '58mm') return { width: 240, height: 700 }
  if (size === '80mm') return { width: 340, height: 700 }
  if (size === 'A5') return isLandscape ? { width: 850, height: 620 } : { width: 620, height: 800 }
  if (size === 'A4') return isLandscape ? { width: 1050, height: 750 } : { width: 900, height: 700 }
  return { width: 900, height: 700 }
}

export const getPrintPageCSS = (): string => {
  const size = getPrintSize()
  if (size === '58mm') return '@page { size: 58mm auto; margin: 0; }'
  if (size === '80mm') return '@page { size: 80mm auto; margin: 0; }'
  if (size === 'A5') return `@page { size: A5 ${getPrintOrientation()}; margin: 10mm; }`
  return `@page { size: A4 ${getPrintOrientation()}; margin: 10mm; }`
}
