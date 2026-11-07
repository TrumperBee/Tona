// GCC - Tailwind design tokens (single source of truth for the palette).
// Documentation: docs/06-DESIGN-SYSTEM.md
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        // Primary dark surfaces: page background, navigation, footers.
        navy: {
          50: "#F1F5FB",
          100: "#E2EAF6",
          200: "#C3D4EC",
          300: "#93B0DA",
          400: "#5C86BF",
          500: "#37669F",
          600: "#275183",
          700: "#1F416A",
          800: "#132B4B",
          900: "#0A1B33",
          950: "#050F1F",
        },
        // Interactive colour: links, primary actions, focus rings, live states.
        electric: {
          50: "#EFF8FF",
          100: "#DBEFFF",
          200: "#BFE3FF",
          300: "#8FD2FF",
          400: "#56B8FF",
          500: "#2E9BFF",
          600: "#157BE8",
          700: "#1162BC",
          800: "#134F96",
          900: "#154276",
          950: "#0D2A4D",
        },
        // Championship accent only: trophies, winners, qualification highlights.
        // Never use gold for ordinary navigation or primary buttons.
        gold: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#F5C443",
          500: "#E0A82E",
          600: "#C08A1B",
          700: "#976A15",
          800: "#7A5617",
          900: "#674818",
          950: "#3B2707",
        },
        // Cool neutral greys for text, borders and muted surfaces.
        grey: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617",
        },
        // Semantic colours. Soft variants are for badges/backgrounds,
        // strong variants for text on light surfaces.
        success: {
          DEFAULT: "#22C55E",
          soft: "#DCFCE7",
          strong: "#15803D",
        },
        warning: {
          DEFAULT: "#F59E0B",
          soft: "#FEF3C7",
          strong: "#B45309",
        },
        danger: {
          DEFAULT: "#EF4444",
          soft: "#FEE2E2",
          strong: "#B91C1C",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      letterSpacing: {
        display: "-0.01em",
        eyebrow: "0.14em",
      },
      boxShadow: {
        card: "0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 24px 48px -32px rgb(0 0 0 / 0.9)",
        focus: "0 0 0 2px #050F1F, 0 0 0 4px #56B8FF",
        dialog: "0 32px 80px -24px rgb(0 0 0 / 0.85)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      backgroundImage: {
        "pitch-grid":
          "linear-gradient(to right, rgb(255 255 255 / 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.035) 1px, transparent 1px)",
        "hero-glow": "radial-gradient(60% 60% at 78% 18%, rgb(46 155 255 / 0.22), transparent 70%)",
        "gold-glow": "radial-gradient(50% 50% at 50% 0%, rgb(245 196 67 / 0.16), transparent 70%)",
      },
      backgroundSize: {
        grid: "48px 48px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97) translateY(4px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-right": "slide-in-right 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-left": "slide-in-left 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-bottom": "slide-in-bottom 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        "toast-in": "toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
