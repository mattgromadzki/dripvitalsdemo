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
        canvas: "#f5f7fb",
        surface: {
          DEFAULT: "#ffffff",
          2: "#fafbfc",
          3: "#f1f3f7",
          4: "#e8eaef",
        },
        border: {
          DEFAULT: "#e8eaef",
          2: "#d8dde6",
        },
        // Text
        ink: {
          DEFAULT: "#1c1c1c",
          2: "#3a3a3a",
          muted: "#7a7a7a",
          "muted-2": "#b5b5b5",
          faint: "#c8c8c8",
        },
        // Brand
        brand: {
          DEFAULT: "#4a8ec7",
          dk: "#3a7ab0",
          md: "#5fa0d4",
          soft: "#e8f0f8",
          softer: "#f1f6fb",
        },
        // Semantic palette (aligned to the patient-portal blue theme)
        green:  { DEFAULT: "#2e7d54", soft: "#e3f0e8" },
        amber:  { DEFAULT: "#b86e1e", soft: "#fef0dd" },
        red:    { DEFAULT: "#b8412a", soft: "#fce8e3" },
        blue:   { DEFAULT: "#4a8ec7", soft: "#e8f0f8" },
        purple: { DEFAULT: "#6b4ea8", soft: "#ede5f5" },
        teal:   { DEFAULT: "#2f8f8f", soft: "#e0f0f0" },
        coral:  { DEFAULT: "#c75d3a", soft: "#fbeae3" },
        pink:   { DEFAULT: "#a8458d", soft: "#f6e8f1" },
        violet: { DEFAULT: "#6b4ea8", soft: "#ede5f5" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(30,45,75,.04)",
        sm: "0 1px 3px rgba(30,45,75,.06)",
        md: "0 4px 14px rgba(30,45,75,.07)",
        xl: "0 20px 56px rgba(30,45,75,.14)",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
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
