import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette Docktor
        docktor: {
          50: '#f4f7f8',
          100: '#e2eaec',
          200: '#c8d7db',
          300: '#a1bac1',
          400: '#7399a3',
          500: '#587d88',
          600: '#4b6873',
          700: '#415660',
          800: '#3a4a52',
          900: '#384d54', // Couleur principale (docker-dark)
          950: '#232f34',
        },
        // Couleurs semantiques
        primary: {
          DEFAULT: '#384d54',
          light: '#4b6873',
          dark: '#232f34',
        },
        accent: {
          DEFAULT: '#0db7ed',
          light: '#5fcdf3',
          dark: '#0a8bb5',
        },
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
