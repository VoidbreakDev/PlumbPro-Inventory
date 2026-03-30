import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'path';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve(__dirname, 'dist/main'),
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve(__dirname, 'dist/preload'),
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'main/preload.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, '..'),
    css: {
      postcss: {
        plugins: [
          tailwindcss({ config: resolve(__dirname, '../tailwind.config.js') }),
          autoprefixer()
        ]
      }
    },
    build: {
      outDir: resolve(__dirname, 'dist/renderer'),
      rollupOptions: {
        input: {
          index: resolve(__dirname, '../index.html')
        }
      }
    }
  }
});
