import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.GMAPS_KEY': JSON.stringify(process.env.GMAPS_KEY),
    'import.meta.env.VITE_GMAPS_KEY': JSON.stringify(process.env.GMAPS_KEY)
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          stripe: ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          charts: ['recharts']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    // Normal caching for stable performance
    hmr: {
      port: 5000,
      host: '0.0.0.0'
    },
    watch: {
      usePolling: true,
      interval: 1000
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        timeout: 60000
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5000
  }
})