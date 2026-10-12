/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Se arman con variables (`status-${estado}`), así que Tailwind no las ve en el código y las borraría
  safelist: ['status-pending', 'status-confirmed', 'status-completed', 'status-cancelled', 'status-no-show'],
  theme: {
    extend: {
      // El diseño usa white/8 y white/12 (bordes suaves); sin esto Tailwind los ignora y el borde sale blanco
      opacity: { 8: '0.08', 12: '0.12' },
      colors: {
        gold: {
          DEFAULT: '#D4AF37',
          50: '#FAF3D0',
          100: '#F5E8A1',
          200: '#EDCF5E',
          300: '#D4AF37',
          400: '#B8952B',
          500: '#9C7B22',
          600: '#7A5F19',
        },
        bronze: '#6B4C2B',
        dark: {
          DEFAULT: '#080808',
          50: '#1a1a1a',
          100: '#141414',
          200: '#0f0f0f',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        display: ['Cinzel', '"Playfair Display"', 'Georgia', 'serif'],
        script: ['Playball', '"Alex Brush"', 'cursive'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Space Grotesk"', 'monospace'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #F5E8A1 50%, #D4AF37 100%)',
        'dark-radial': 'radial-gradient(ellipse at center, #141414 0%, #080808 70%)',
      },
      animation: {
        'shimmer': 'shimmer 2.5s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'bounce-slow': 'bounce 2s infinite',
        'spin-slow': 'spin 8s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.4s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.4)' },
          '50%': { boxShadow: '0 0 0 20px rgba(212, 175, 55, 0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
