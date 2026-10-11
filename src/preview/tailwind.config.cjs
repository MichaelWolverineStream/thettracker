module.exports = {
  content: ['./src/preview/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {},
  purge: {
    options: { safelist: ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'] },
  },
  plugins: [require('tailwindcss-animate')],
};