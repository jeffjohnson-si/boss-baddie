/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ---- BOSS BADDIE palette (see README) ----
        bbBlack: '#000000',
        bbRose: '#ff4b8b', // primary accent — dusty rose-pink
        bbBurgundy: '#701938', // secondary accent — muted burgundy
        bbBlush: '#ffc2d4', // soft blush
        bbInk: '#f8f8f8', // off-white text
        bbGold: '#e3b873', // sparkle / crown gold
        bbCoal: '#0b0709', // barely-lifted black for cards
        bbLine: 'rgba(248,248,248,0.12)', // hairline borders on black
      },
      fontFamily: {
        // Serif display = editorial magazine feel, sans body = legible on phones.
        // Both are system stacks: zero webfont downloads on slow island links.
        display: ['Georgia', "'Times New Roman'", "'Noto Serif'", 'serif'],
        body: ["'Segoe UI'", 'system-ui', '-apple-system', "'Helvetica Neue'", 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        editorial: '0.32em',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: '0.25', transform: 'scale(0.85)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        twinkle: 'twinkle 3.6s ease-in-out infinite',
        riseIn: 'riseIn 0.6s ease-out both',
      },
    },
  },
  plugins: [],
};
