/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#151A21',
        slate: {
          DEFAULT: '#5A6675',
          light: '#8A95A3',
        },
        chassis: '#DDE2E8',
        panel: '#FFFFFF',
        well: '#F4F6F9',
        ultramarine: {
          DEFAULT: '#2B3FD9',
          soft: '#E6E9FB',
        },
        amber: {
          DEFAULT: '#E0A008',
          soft: '#FBF0D6',
        },
        oxide: {
          DEFAULT: '#A8382B',
          soft: '#F7E4E1',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        none: '0',
        DEFAULT: '2px',
        sm: '2px',
        md: '2px',
        lg: '3px',
      },
      boxShadow: {
        // Instruments do not glow. Depth comes from hairlines and wells.
        none: 'none',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
    },
  },
  plugins: [],
}
