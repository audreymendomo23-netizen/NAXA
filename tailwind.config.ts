import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        naxa: {
          green: { 900: "#064B2A", 700: "#0A6B3A", 600: "#0E8545", 500: "#17A354", 100: "#DDF3E6", 50: "#F2FAF5" },
          canari: { DEFAULT: "#FFE33D", dark: "#E6C700" },
          ink: "#0A2A1B",
        },
        naxaClient: { green: "#0F6B3F", forest: "#0B3D26", yellow: "#FFE23D", paleYellow: "#FFF3B0", sheet: "#F4F8F5", card: "#FFFFFF" },
      },
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] },
      borderRadius: { xl2: "1.25rem", "naxa-sheet": "28px" },
      boxShadow: { "naxa-soft": "0 6px 18px rgba(0,0,0,0.08)", "naxa-yellow": "0 6px 18px rgba(255,226,61,0.25)" },
    },
  },
  plugins: [],
};
export default config;
