/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#00D2B4',
          light: '#80EEE0',
          dark: '#00A890',
          dim: '#007A68',
        },
        surface: {
          DEFAULT: '#040E0E',
          100: '#071414',
          200: '#0A1A1A',
          300: '#0D2020',
          400: '#112828',
          500: '#163030',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
