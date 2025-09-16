export const isThermalPrinting = () => localStorage.getItem('thermalPrinting') === 'true'

export const getThermalPrintStyles = () => {
  return {
    container: isThermalPrinting() 
      ? { fontFamily: 'monospace', width: '150mm', margin: '0 auto', padding: '5px', background: 'white', color: 'black', fontSize: '12px', lineHeight: '1.2' }
      : { fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px', background: 'white', color: 'black' }
  }
}