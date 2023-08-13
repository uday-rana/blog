/** @type {import('tailwindcss').Config} */
export default {
  content: ['./views/*.hbs',
            './views/layouts/*.hbs'],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
}

