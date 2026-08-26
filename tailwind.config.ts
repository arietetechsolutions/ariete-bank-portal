import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      screens: { xs: "480px" },
      // Plus Jakarta Sans is the only family in the product: no display face,
      // no mono. Tabular figures come from font-variant-numeric instead.
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        sidebar: "hsl(var(--sidebar))",
        info: "hsl(var(--info))",
        // Three steps below muted-foreground, for column labels, placeholders
        // and the figures on a stage nobody is sitting in.
        subtle: "hsl(var(--subtle))",
        dim: "hsl(var(--dim))",
        dormant: "hsl(var(--dormant))",
        // Keyed to the next action, not to funnel position.
        // Each tone carries a base (bar/flag) and a lighter fg (chip text),
        // because a 13%-alpha chip needs its label a step brighter to stay
        // readable against the tint.
        stage: {
          neutral: { DEFAULT: "hsl(var(--stage-neutral))", fg: "#B9C3D4" },
          info: { DEFAULT: "hsl(var(--stage-info))", fg: "#8FBBE6" },
          gold: { DEFAULT: "hsl(var(--stage-gold))", fg: "#DCC28C" },
          ok: { DEFAULT: "hsl(var(--stage-ok))", fg: "#6FC49C" },
        },
        stall: { DEFAULT: "hsl(var(--stall))", foreground: "hsl(var(--stall-foreground))" },
        lost: { DEFAULT: "hsl(var(--lost))", foreground: "hsl(var(--lost-foreground))", chip: "#B9A4B2" },
      },
      // 12px cards, 10px controls, 8px small, pills for badges. Nothing is
      // square-cornered and nothing exceeds 12px except pills.
      borderRadius: {
        sm: "8px",
        DEFAULT: "10px",
        md: "10px",
        lg: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius)",
      },
      // All motion is ease-out and short. Nothing bounces, nothing springs.
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { "fade-in": "fade-in 500ms cubic-bezier(0, 0, 0.2, 1) both" },
      transitionDuration: { fast: "150ms", normal: "200ms", slow: "300ms", enter: "500ms" },
      transitionTimingFunction: { standard: "cubic-bezier(0, 0, 0.2, 1)" },
      letterSpacing: { tight: "-0.015em" },
      fontSize: {
        "2xs": ["10px", "1.5"], xs: ["12px", "1.5"], sm: ["14px", "1.5"],
        base: ["16px", "1.5"], lg: ["18px", "1.25"], xl: ["20px", "1.25"],
        "2xl": ["24px", "1.25"], "3xl": ["30px", "1.25"],
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
