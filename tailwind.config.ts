import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-app)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8dc1ff',
          400: '#579fff',
          500: '#2f7eff',
          600: '#1862f5',
          700: '#124de1',
          800: '#1640b5',
          900: '#173b8e',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f6f7fb',
          border: '#e6e8ef',
        },
        ink: {
          DEFAULT: '#0f172a',
          muted: '#475569',
          subtle: '#64748b',
        },
        status: {
          draft: '#94a3b8',
          pending: '#f59e0b',
          accepted: '#10b981',
          declined: '#ef4444',
          production: '#3b82f6',
          ready: '#8b5cf6',
          delivered: '#22c55e',
          redo: '#f97316',
          cancelled: '#6b7280',
        },
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        pop: '0 10px 30px -10px rgba(15, 23, 42, 0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
