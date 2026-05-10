import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-instrument-serif)", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "Menlo", "monospace"],
      },
      colors: {
        bg: "var(--bg)",
        "bg-card": "var(--bg-card)",
        "bg-hover": "var(--bg-hover)",
        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        accent: "var(--accent)",
        "accent-dim": "var(--accent-dim)",
        green: "var(--green)",
        "green-dim": "var(--green-dim)",
        red: "var(--red)",
        "red-dim": "var(--red-dim)",
        blue: "var(--blue)",
        "blue-dim": "var(--blue-dim)",
      },
      animation: {
        "fade-in": "fade-in 0.2s ease forwards",
        "slide-up": "slide-up 0.3s ease forwards",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        marquee: "marquee 40s linear infinite",
        "progress-fill": "progress-fill 0.6s ease-out forwards",
        "stamp-in": "stamp-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "verdict-fade": "verdict-fade 0.3s ease forwards",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(16,185,129,0.4)" },
          "50%": { opacity: "0.3", boxShadow: "0 0 0 6px rgba(16,185,129,0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "progress-fill": {
          "0%": { width: "0%" },
          "100%": { width: "var(--progress-width)" },
        },
        "stamp-in": {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "verdict-fade": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
