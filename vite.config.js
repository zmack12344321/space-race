import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteCompression({ algorithm: 'brotliCompress' }),
    viteCompression({ algorithm: 'gzip' })
  ],
  resolve: {
    dedupe: ['three', '@react-three/fiber'],
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          rapier: ['@react-three/rapier', '@dimforge/rapier3d-compat'],
          ecctrl: ['ecctrl']
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/rapier',
      'three-stdlib',
    ],
  },
})
