import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.DEMO_MODE': JSON.stringify(process.env.DEMO_MODE || process.env.VITE_DEMO_MODE || 'false'),
      'process.env.SCHOOL_NAME': JSON.stringify(process.env.SCHOOL_NAME || process.env.VITE_SCHOOL_NAME || 'University of Cebu - LM Campus'),
      'process.env.APP_TIMEZONE': JSON.stringify(process.env.APP_TIMEZONE || process.env.VITE_APP_TIMEZONE || 'Asia/Manila'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
