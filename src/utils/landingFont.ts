import { useEffect } from 'react'

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'

// Loaded only by public marketing pages, so the signed-in app never downloads it.
export function useLandingFont() {
  useEffect(() => {
    if (document.querySelector('link[data-font="inter"]')) return
    const preconnectGoogle = document.createElement('link')
    preconnectGoogle.rel = 'preconnect'
    preconnectGoogle.href = 'https://fonts.googleapis.com'
    const preconnectStatic = document.createElement('link')
    preconnectStatic.rel = 'preconnect'
    preconnectStatic.href = 'https://fonts.gstatic.com'
    preconnectStatic.crossOrigin = 'anonymous'
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = FONT_URL
    stylesheet.dataset.font = 'inter'
    document.head.append(preconnectGoogle, preconnectStatic, stylesheet)
  }, [])
}
