import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    sourcemap: false,

    // Raise chunk-size warning threshold — admin pages are legitimately large
    chunkSizeWarningLimit: 1200,

    rollupOptions: {
      output: {
        // ── Deterministic chunk names so browser caches survive re-deploys ──
        // Hashed filenames mean CDN/browser caches are invalidated only when the
        // file actually changes (GoDaddy shared hosting benefits greatly from this).
        entryFileNames:   'assets/[name]-[hash].js',
        chunkFileNames:   'assets/[name]-[hash].js',
        assetFileNames:   'assets/[name]-[hash][extname]',

        manualChunks: (id) => {
          // ── Vendor: React core (tiny, loads first) ──────────────────────
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }

          // ── Heavy chart library ─────────────────────────────────────────
          if (id.includes('node_modules/recharts')) {
            return 'vendor-recharts';
          }

          // ── Export tools (only loaded when admin explicitly exports) ────
          if (
            id.includes('node_modules/exceljs') ||
            id.includes('node_modules/file-saver') ||
            id.includes('node_modules/papaparse') ||
            id.includes('node_modules/pptxgenjs')
          ) {
            return 'vendor-export';
          }

          // ── Google OAuth + JWT (auth flow only) ─────────────────────────
          if (id.includes('node_modules/@react-oauth') || id.includes('node_modules/jwt-decode')) {
            return 'vendor-auth';
          }

          // ── QR code renderer (used in receipts / walk-in only) ──────────
          if (id.includes('node_modules/qrcode')) {
            return 'vendor-qr';
          }

          // ── AOS animations ───────────────────────────────────────────────
          if (id.includes('node_modules/aos')) {
            return 'vendor-aos';
          }

          // ── Admin pages: split each heavy page into its own async chunk ──
          // Vite's lazy() imports already create async chunks; these manual
          // entries are fallbacks for any eagerly-imported admin sub-modules.
          if (id.includes('/src/admin/Schedule')) return 'admin-schedule';
          if (id.includes('/src/admin/Booking'))  return 'admin-booking';
          if (id.includes('/src/admin/SalePayment')) return 'admin-sales';
          if (id.includes('/src/admin/WalkInEnrollment')) return 'admin-walkin';
          if (id.includes('/src/admin/User'))     return 'admin-users';
          if (id.includes('/src/admin/CourseManagement')) return 'admin-courses';
          if (id.includes('/src/admin/')) return 'admin-misc';
        },
      },
    },
  },

  // Speed up dev server HMR (does not affect production)
  server: {
    hmr: { overlay: true },
  },
})
