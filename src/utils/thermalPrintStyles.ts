export const isThermalPrinting = () => localStorage.getItem('thermalPrinting') === 'true'

export const getThermalPrintStyles = () => {
  return {
    container: isThermalPrinting() 
      ? { fontFamily: 'monospace', width: '100%', maxWidth: '80mm', margin: '0', padding: '2px', background: 'white', color: 'black', fontSize: '12px', lineHeight: '1.1' }
      : { fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '10px', background: 'white', color: 'black' }
  }
}