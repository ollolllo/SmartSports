import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'action-capture': resolve(__dirname, 'action-capture.html'),
        'action-tracker': resolve(__dirname, 'action-tracker.html'),
        'action-capture-mediapipe': resolve(__dirname, 'action-capture-mediapipe.html'),
        'game-treasure-catch': resolve(__dirname, 'game-treasure-catch.html')
      }
    }
  },
  optimizeDeps: {
    include: ['@tensorflow/tfjs', '@tensorflow-models/pose-detection']
  },
  server: {
    host: true,
    port: 3000,
    https: false
  }
})