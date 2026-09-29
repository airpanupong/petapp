import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';

// Deploy time in Bangkok, e.g. 2026.09.29-0139.
const BUILT_AT = new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Bangkok', hour12: false});
const APP_VERSION = `${BUILT_AT.slice(0, 10).replace(/-/g, '.')}-${BUILT_AT.slice(11, 16).replace(':', '')}`;

function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({type: 'asset', fileName: 'version.json', source: JSON.stringify({version: APP_VERSION})});
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile()],
  define: {__APP_VERSION__: JSON.stringify(APP_VERSION)},
  server: {port: 5173, host: true},
  preview: {port: 4173, host: true},
});
