import { defineConfig } from 'vite';
import {startupTracePlugin} from './src/startup-trace-plugin.mjs';

export default defineConfig({
  publicDir: 'assets/web',
  build: { rollupOptions: { input: { main: 'index.html', gallery: 'gallery.html' } } },
  plugins:[startupTracePlugin()],
  optimizeDeps: { include: ['three/addons/objects/Reflector.js'] },
});
