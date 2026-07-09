import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The stand-in identity service (standin-service/) runs on 127.0.0.1:8081. We proxy
// /api/* to it so the browser makes same-origin requests — no CORS config needed on
// the stand-in, and the vendored specs stay untouched.
const STANDIN_URL = process.env.STANDIN_URL ?? 'http://127.0.0.1:8081';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: STANDIN_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
