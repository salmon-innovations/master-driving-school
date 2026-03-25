import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          exportTools: ['exceljs', 'file-saver', 'papaparse', 'pptxgenjs'],
        },
      },
    },
  },
})
