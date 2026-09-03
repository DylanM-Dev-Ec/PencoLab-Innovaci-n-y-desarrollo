/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  // No reset global: la app ya tiene index.css propio
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        penco: {
          light: '#d8efe4',
          mid: '#5aa887',
          forest: '#0d4f36',
          deep: '#083826',
          slate: '#475569',
          blue: '#334155',
        },
      },
      fontFamily: {
        display: ['"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 12px 40px rgba(13, 79, 54, 0.12)',
      },
    },
  },
  plugins: [],
}
