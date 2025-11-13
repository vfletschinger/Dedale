/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Include paths to all files that contain NativeWind classes.
  // The project places most source files under `src/`, so include it.
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
