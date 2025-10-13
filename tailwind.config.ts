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
        primary: '#25D366',
        'primary-dark': '#128C7E',
        'chat-bg': '#0a0a0a',
        'message-sent': '#005C4B',
        'message-received': '#202C33',
      },
    },
  },
  plugins: [],
}
export default config


