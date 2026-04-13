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
    https: false,
    fs: {
      allow: ['..', resolve(__dirname)]
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, *'
    }
  },
  assetsInclude: ['**/*.tflite', '**/*.wasm', '**/*.data', '**/*.binarypb'],
  plugins: [
    {
      name: 'tflite-mime-type',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url.endsWith('.tflite')) {
            res.setHeader('Content-Type', 'application/octet-stream');
          }
          next();
        });
      }
    }
  ]
})
