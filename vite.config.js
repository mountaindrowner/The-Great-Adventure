import { defineConfig } from 'vite';

// Minimal config. getUserMedia works on http://localhost without HTTPS,
// so `npm run dev` is enough for the demo. `host: true` lets you open it
// from another device on the LAN (that path needs HTTPS for the camera).
export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
});
