import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Modern design system based on uploaded images
        primary: '#00C851', // Vibrant green from the designs
        'primary-dark': '#00A041',
        'primary-light': '#4DD865',
        'chat-bg': '#F8F9FA', // Light gray background
        'chat-header': '#FFFFFF', // White header
        'message-sent': '#00C851', // Green for sent messages
        'message-received': '#E9ECEF', // Light gray for received messages
        'text-primary': '#212529', // Dark gray text
        'text-secondary': '#6C757D', // Medium gray text
        'text-light': '#ADB5BD', // Light gray text
        'border-light': '#DEE2E6', // Light border
        'accent-blue': '#1E40AF', // Dark blue for icons
        'accent-gold': '#F59E0B', // Gold accent color
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'chat': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'message': '0 1px 2px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}
export default config


