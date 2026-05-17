/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
      },
      colors: {
        bg:       '#0d0e11',
        surface:  '#13151a',
        surface2: '#1a1d24',
        surface3: '#21252f',
        accent:   '#6366f1',
        accent2:  '#818cf8',
      },
    },
  },
  plugins: [],
}
