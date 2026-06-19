import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: "#f7f8fa",
        surface: {
          DEFAULT: "#ffffff",
          2: "#fbfbfc",
          3: "#f4f6f8",
          4: "#eaedf2",
        },
        border: {
          DEFAULT: "#e9ebef",
          2: "#d8dee7",
        },
        // Text
        ink: {
          DEFAULT: "#202124",
          2: "#3f4652",
          muted: "#777f8c",
          "muted-2": "#aab2bd",
          faint: "#c8c8c8",
        },
        // Brand
        brand: {
          DEFAULT: "#2f6f9f",
          dk: "#285f89",
          md: "#4d86b1",
          soft: "#eef6fb",
          softer: "#f7fbfd",
        },
        // Semantic palette (aligned to the patient-portal blue theme)
        green:  { DEFAULT: "#6f8d6a", soft: "#f1f7ef" },
        amber:  { DEFAULT: "#b78b58", soft: "#fbf5ec" },
        red:    { DEFAULT: "#b56b6b", soft: "#fbf0f0" },
        blue:   { DEFAULT: "#2f6f9f", soft: "#eef6fb" },
        purple: { DEFAULT: "#8a7bbd", soft: "#f4f1fb" },
        teal:   { DEFAULT: "#5d8f8a", soft: "#eef7f5" },
        coral:  { DEFAULT: "#b56b6b", soft: "#fbf0f0" },
        pink:   { DEFAULT: "#8a7bbd", soft: "#f4f1fb" },
        violet: { DEFAULT: "#8a7bbd", soft: "#f4f1fb" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(35,42,52,.035)",
        sm: "0 6px 18px rgba(35,42,52,.04)",
        md: "0 10px 28px rgba(35,42,52,.055)",
        xl: "0 24px 64px rgba(35,42,52,.12)",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "18px",
        pill: "999px",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          from: { opacity: "0", transform: "scale(.96) translateY(8px)" },
          to:   { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.25s ease both",
        popIn: "popIn 0.22s ease",
      },
    },
  },
  plugins: [],
};

export default config;
