import type { Config } from "tailwindcss";

// Khaki #C0B281 · Oxblood #550605 · Gold #D8A93D. Sharp corners everywhere (radius is zeroed).
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    borderRadius: { none: "0", sm: "0", DEFAULT: "0", md: "0", lg: "0", xl: "0", "2xl": "0", "3xl": "0", full: "0" },
    extend: {
      colors: {
        khaki: { DEFAULT: "#C0B281", light: "#E6DFC4", dark: "#A89A66" },
        oxblood: { DEFAULT: "#550605", light: "#7A1411", dark: "#3A0403" },
        gold: { DEFAULT: "#D8A93D", light: "#E8C466", dark: "#B8891F" },
        ink: { DEFAULT: "#2E0907", soft: "#550605", mute: "#6F5F3F" },
        bus: { DEFAULT: "#D8A93D", deep: "#8A6512", soft: "#F3E7C2" }, // gold (old class names keep working)
        vulcan: { DEFAULT: "#D8A93D", deep: "#8A6512", soft: "#F3E7C2" },
        paper: { DEFAULT: "#EFEAD7", line: "#D6CCA9", light: "#F8F5EA", dark: "#E1D8B8" },
        alert: "#B42318",
        ok: "#2F6B3A",
      },
      fontFamily: { display: ["var(--font-display)", "system-ui", "sans-serif"], sans: ["var(--font-body)", "system-ui", "sans-serif"] },
      keyframes: { shimmer: { "100%": { transform: "translateX(100%)" } }, pop: { "0%": { transform: "translateY(6px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } } },
      animation: { shimmer: "shimmer 1.4s infinite", pop: "pop .16s ease-out" },
    },
  },
} satisfies Config;
