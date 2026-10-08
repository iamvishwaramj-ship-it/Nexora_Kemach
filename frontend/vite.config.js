import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3101,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  // Without an explicit build section the whole vendor layer (React, MUI,
  // Emotion, Redux Toolkit, i18next) shipped in one ~810 KB entry chunk
  // together with the app shell, so bumping any single dependency
  // invalidated every user's cached copy of all of it. Splitting the big,
  // rarely-changing libraries into their own chunks lets them stay cached
  // across app deploys.
  build: {
    target: 'es2020',
    // Vite's production default, stated explicitly so it is a visible
    // decision rather than an inherited one. Nothing in the project
    // consumes prod sourcemaps.
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Kept deliberately flat: each library sits wholly inside one
        // chunk. Splitting a single library across chunks (e.g. MUI apart
        // from its Emotion styling engine) risks circular-initialisation
        // errors at load time, which is a far worse outcome than a chunk
        // being slightly larger than ideal.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@emotion/react', '@emotion/styled'],
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          'vendor-forms': ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
  },
})
