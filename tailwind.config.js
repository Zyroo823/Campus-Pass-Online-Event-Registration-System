/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F3EEE3',
          light: '#FAF7F0',
          dark: '#E7DFD1',
          contrast: '#DDD2BF',
        },
        ink: {
          DEFAULT: '#17150F',
          light: '#2C2820',
          muted: '#38342B',
          faint: '#524C40',
        },
        vermilion: {
          DEFAULT: '#D9441F',
          hover: '#BF3613',
          faint: '#FBECE8',
        },
        olive: {
          DEFAULT: '#5B6B3A',
          hover: '#4A582E',
          faint: '#F0F3EA',
        },
        mustard: {
          DEFAULT: '#C99A1B',
          hover: '#AD8212',
          faint: '#FBF5E5',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'serif', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        hard: '3px 3px 0px #17150F',
        'hard-sm': '2px 2px 0px #17150F',
        'hard-lg': '5px 5px 0px #17150F',
      },
    },
  },
  plugins: [],
};
