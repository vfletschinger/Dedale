/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Couleur principale
        primary: {
          DEFAULT: "#101828",
        },
        // Couleur secondaire
        secondary: {
          DEFAULT: "#2E4574",
        },
        // Couleur d'accent
        accent: {
          DEFAULT: "#EAB308",
        },
      },
    },
  },
  plugins: [],
};
