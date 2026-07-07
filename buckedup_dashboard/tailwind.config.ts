import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F5EEDB",
        seasalt: "#F9F7F7",
        serpent: "#133020",
        castleton: "#046241",
        saffron: "#FFB347",
        "earth-yellow": "#FFC370",
        line: "#E4DDC9",
        ink: "#133020",
        "ink-soft": "#5B7268",
        green: {
          2: "#034E34",
          3: "#417256",
          4: "#708E7C",
          5: "#9CAFA4",
        },
        neutral: {
          1: "#666666",
          2: "#999999",
          3: "#CCCCCC",
          4: "#E6E6E6",
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      keyframes: {
        pulse2: {
          "0%": { boxShadow: "0 0 0 0 rgba(4,98,65,0.4)" },
          "70%": { boxShadow: "0 0 0 6px rgba(4,98,65,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(4,98,65,0)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulse2: "pulse2 2s infinite",
        fadeUp: "fadeUp .3s ease",
      },
    },
  },
  plugins: [],
};
export default config;
