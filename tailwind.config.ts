import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))"
        },
        /**
         * Semantic action buttons (fixed hex) — use named classes so backgrounds
         * are always in the built CSS (avoids missing arbitrary `bg-[#..]` in edge cases).
         */
        action: {
          reserve: { DEFAULT: "#3B82F6", hover: "#2563EB" },
          book: { DEFAULT: "#22C55E", hover: "#16A34A" },
          edit: { DEFAULT: "#F59E0B", hover: "#D97706" },
          archive: { DEFAULT: "#6B7280", hover: "#4B5563" },
          view: { DEFAULT: "#8B5CF6", hover: "#7C3AED" },
          cancel: { DEFAULT: "#D1D5DB", hover: "#C4C8CF" },
          save: { DEFAULT: "#10B981", hover: "#059669" },
          update: { DEFAULT: "#2563EB", hover: "#1D4ED8" },
          approve: { DEFAULT: "#16A34A", hover: "#15803D" },
          reject: { DEFAULT: "#DC2626", hover: "#B91C1C" },
          danger: { DEFAULT: "#EF4444", hover: "#DC2626" },
          /** Muted text on booking state (success / pending) chip buttons */
          "ink-ok": { DEFAULT: "#15803D" },
          "ink-pending": { DEFAULT: "#B45309" }
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out"
      }
    }
  },
  plugins: []
};

export default config;

