/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: '#121826',
        primary: '#6366f1',
        secondary: '#ec4899',
      },
    },
  },
  plugins: [],
};
