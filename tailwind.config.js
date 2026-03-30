/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: {
    relative: true,
    files: [
      './index.html',
      './App.tsx',
      './index.tsx',
      './app/**/*.{js,ts,jsx,tsx}',
      './components/**/*.{js,ts,jsx,tsx}',
      './hooks/**/*.{js,ts,jsx,tsx}',
      './lib/**/*.{js,ts,jsx,tsx}',
      './services/**/*.{js,ts,jsx,tsx}',
      './store/**/*.{js,ts,jsx,tsx}',
      './views/**/*.{js,ts,jsx,tsx}'
    ]
  },
  theme: {
    extend: {}
  },
  plugins: []
};
