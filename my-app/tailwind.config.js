// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "480px",
        sml: "600px",
        med: "768px",
        lrg: "1024px",
        xlrg: "1280px",
        
      },
    },
  },
  plugins: [],
}
