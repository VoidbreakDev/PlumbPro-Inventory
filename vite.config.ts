import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const HTML_LAZY_CHUNK_TOKENS = ['charts', 'excel-', 'pdf-', 'scanner'];

const MANUAL_CHUNK_GROUPS = [
  {
    name: 'charts',
    patterns: [
      '/recharts/',
      '/recharts-scale/',
      '/victory-vendor/',
      '/d3-array/',
      '/d3-color/',
      '/d3-ease/',
      '/d3-format/',
      '/d3-interpolate/',
      '/d3-path/',
      '/d3-scale/',
      '/d3-shape/',
      '/d3-time/',
      '/d3-time-format/',
      '/d3-timer/',
    ],
  },
  {
    name: 'pdf-core',
    patterns: ['/jspdf/', '/jspdf-autotable/'],
  },
  {
    name: 'pdf-renderers',
    patterns: [
      '/html2canvas/',
      '/canvg/',
      '/css-line-break/',
      '/fflate/',
      '/raf/',
      '/performance-now/',
      '/rgbcolor/',
      '/stackblur-canvas/',
      '/svg-pathdata/',
    ],
  },
  {
    name: 'excel-core',
    patterns: ['/exceljs/'],
  },
  {
    name: 'excel-csv',
    patterns: ['/fast-csv/', '/@fast-csv/', '/dayjs/'],
  },
  {
    name: 'excel-streams',
    patterns: [
      '/readable-stream/',
      '/string_decoder/',
      '/safe-buffer/',
      '/duplexer2/',
      '/lazystream/',
    ],
  },
  {
    name: 'excel-zip',
    patterns: [
      '/jszip/',
      '/pako/',
      '/archiver/',
      '/archiver-utils/',
      '/compress-commons/',
      '/zip-stream/',
      '/crc32-stream/',
      '/crc-32/',
    ],
  },
  {
    name: 'excel-xml',
    patterns: ['/saxes/', '/xmlchars/', '/uuid/'],
  },
  {
    name: 'scanner',
    patterns: ['/html5-qrcode/'],
  },
  {
    name: 'icons',
    patterns: ['/lucide-react/'],
  },
  {
    name: 'storage',
    patterns: ['/localforage/', '/lie/'],
  },
];

export default defineConfig(() => {
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        allowedHosts: ['localhost', '127.0.0.1', '192.168.1.106'],
        proxy: {
          '/api': {
            target: 'http://localhost:5001',
            changeOrigin: true
          },
          '/health': {
            target: 'http://localhost:5001',
            changeOrigin: true
          },
          '/invoices': {
            target: 'http://localhost:5001',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/invoices/, '/api/invoices')
          },
          '/portal': {
            target: 'http://localhost:5001',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/portal/, '/api/portal')
          },
          '/uploads': {
            target: 'http://localhost:5001',
            changeOrigin: true
          }
        }
      },
      plugins: [react()],
      build: {
        modulePreload: {
          resolveDependencies: (_filename, deps, context) => {
            if (context.hostType !== 'html') {
              return deps;
            }

            return deps.filter(
              (dep) => !HTML_LAZY_CHUNK_TOKENS.some((token) => dep.includes(token))
            );
          }
        },
        rollupOptions: {
          output: {
            onlyExplicitManualChunks: true,
            manualChunks(id) {
              const normalizedId = id.replace(/\\/g, '/');

              if (!normalizedId.includes('/node_modules/')) {
                return undefined;
              }

              for (const chunk of MANUAL_CHUNK_GROUPS) {
                if (chunk.patterns.some((pattern) => normalizedId.includes(pattern))) {
                  return chunk.name;
                }
              }

              if (
                normalizedId.includes('/react/') ||
                normalizedId.includes('/react-dom/') ||
                normalizedId.includes('/react-router-dom/') ||
                normalizedId.includes('/zustand/')
              ) {
                return 'react-vendor';
              }

              if (
                normalizedId.includes('/axios/') ||
                normalizedId.includes('/date-fns/') ||
                normalizedId.includes('/i18next/') ||
                normalizedId.includes('/react-i18next/') ||
                normalizedId.includes('/i18next-browser-languagedetector/')
              ) {
                return 'app-vendor';
              }

              return 'vendor';
            }
          }
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          exceljs: path.resolve(__dirname, 'node_modules/exceljs/lib/exceljs.browser.js'),
        }
      }
    };
});
