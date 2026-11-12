/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Warm amber "brand" scale — the app's cooking identity.
        brand: {
          50: '#fdf8ef', 100: '#fbeedc', 200: '#f6ddb8', 300: '#eec48a',
          400: '#e5a558', 500: '#d97706', 600: '#b45309', 700: '#92400e',
          800: '#78350f', 900: '#451a03',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 16px rgba(15, 23, 42, 0.05)',
        lift: '0 4px 10px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.10)',
      },
    },
  },
  plugins: [],
};
