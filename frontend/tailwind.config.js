/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'fade-in':      'fadeIn 0.2s ease-out',
        'slide-up':     'slideUp 0.25s ease-out',
        'slide-left':   'slideInLeft 0.3s ease-out',
        'pulse-soft':   'pulseSoft 2s ease-in-out infinite',
        'count-up':     'countUp 0.4s ease-out',
        'shimmer':      'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn:      { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:     { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInLeft: { from: { opacity: '0', transform: 'translateX(-12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseSoft:   { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        countUp:     { from: { opacity: '0', transform: 'translateY(8px) scale(0.95)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        shimmer:     { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};
