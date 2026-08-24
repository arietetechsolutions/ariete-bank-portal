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
      fontFamily: {
        sans: ["Montserrat", "-apple-system", "Helvetica", "Arial", "sans-serif"],
        display: ['"Playfair Display"', "Georgia", '"Times New Roman"', "serif"],
        mono: ['"Fragment Mono"', "ui-monospace", "Menlo", "monospace"],
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
        lost: { DEFAULT: "hsl(var(--lost))", foreground: "hsl(var(--lost-foreground))" },
      },
      borderRadius: {
        lg: "4px",
        md: "var(--radius)",
        sm: "2px",
      },
      // Motion is understated: fades and opacity only, 120-360ms, standard
      // easing. No bounce, spring, parallax, or translate-on-enter.
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: { "fade-in": "fade-in 200ms cubic-bezier(.4,0,.2,1) forwards" },
      transitionDuration: { fast: "120ms", normal: "200ms", slow: "360ms" },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
