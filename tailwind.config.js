/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hv: {
          bg: '#0b1426',
          card: '#111f3a',
          border: '#1e3a5f',
          accent: '#2563eb',
          'accent-light': '#3b82f6',
          muted: '#64748b',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pop': 'pop 0.15s ease-out',
        'flash': 'flash 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { transform: 'scale(0.85)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        pop: { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.12)' }, '100%': { transform: 'scale(1)' } },
        flash: { '0%': { opacity: '1' }, '50%': { opacity: '0.3' }, '100%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
}


