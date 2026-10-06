import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const vendorChunk = (id: string): string | undefined => {
  if (!id.includes('node_modules')) return undefined
  if (/node_modules\/@firebase\/(analytics|installations)\//.test(id) || /node_modules\/firebase\/analytics/.test(id)) return 'firebase-analytics'
  if (/node_modules\/(firebase|@firebase)\//.test(id)) return 'firebase'
  if (/node_modules\/@supabase\//.test(id)) return 'supabase'
  if (/node_modules\/react-icons\//.test(id)) return 'icons'
  if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@tanstack)\//.test(id)) return 'react-core'
  return undefined
}

export default defineConfig({
	plugins: [react()],
	build: {
		rollupOptions: {
			output: {
				manualChunks: vendorChunk,
			},
		},
	},
})
