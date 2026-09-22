import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['var(--font-pixel)'],
      },
      colors: {
        midnight: '#0a0a1a',
        card: '#111128',
        dopamine: '#22c55e',
        shock: '#ef4444',
        accent: {
          purple: '#8b5cf6',
          cyan: '#06b6d4',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'dopamine-glow': 'dopamineGlow 1.2s ease-out',
        'shock-flash': 'shockFlash 0.6s ease-in-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'float-bob': 'floatBob 2.6s ease-in-out infinite',
        'happy-bounce': 'happyBounce 0.7s ease-in-out infinite',
        shake: 'shake 0.4s ease-in-out infinite',
        'node-pulse': 'nodePulse 1.6s ease-in-out infinite',
      },
      keyframes: {
        dopamineGlow: {
          '0%': { boxShadow: '0 0 0px rgba(34,197,94,0)' },
          '30%': { boxShadow: '0 0 60px rgba(34,197,94,0.55)' },
          '100%': { boxShadow: '0 0 0px rgba(34,197,94,0)' },
        },
        shockFlash: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(239,68,68,0.25)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        floatBob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        happyBounce: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-14px) scale(1.1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '25%': { transform: 'translateX(-5px) rotate(-4deg)' },
          '75%': { transform: 'translateX(5px) rotate(4deg)' },
        },
        nodePulse: {
          '0%, 100%': { opacity: '0.7', r: '12' },
          '50%': { opacity: '1', r: '15' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
