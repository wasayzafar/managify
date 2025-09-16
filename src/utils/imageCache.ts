const imageCache = new Map<string, string>()

export const preloadImageAsBase64 = async (src: string): Promise<string> => {
  if (imageCache.has(src)) {
    return imageCache.get(src)!
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        ctx?.drawImage(img, 0, 0)
        const base64 = canvas.toDataURL('image/png')
        imageCache.set(src, base64)
        resolve(base64)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = reject
    img.src = src
  })
}

export const getCachedImage = (src: string): string | null => {
  return imageCache.get(src) || null
}