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
        // One entry per stage - see the block in index.css for why, and for
        // the contrast figures behind each fg. Class strings must be literal
        // for Tailwind to emit them, so StageChip maps tones to fixed classes
        // rather than interpolating these names.
        stage: {
          registered: { DEFAULT: "hsl(var(--stage-registered))", fg: "#A8B3C2" },
          onboarding: { DEFAULT: "hsl(var(--stage-onboarding))", fg: "#BD9CF6" },
          opened: { DEFAULT: "hsl(var(--stage-opened))", fg: "#6AB2FB" },
          "awaiting-transfer": { DEFAULT: "hsl(var(--stage-awaiting-transfer))", fg: "#4CE6D9" },
          "awaiting-aml": { DEFAULT: "hsl(var(--stage-awaiting-aml))", fg: "#FAC938" },
          "aml-issued": { DEFAULT: "hsl(var(--stage-aml-issued))", fg: "#A6D85A" },
          executed: { DEFAULT: "hsl(var(--stage-executed))", fg: "#52E086" },
        },
        stall: { DEFAULT: "hsl(var(--stall))", foreground: "hsl(var(--stall-foreground))" },
        lost: { DEFAULT: "hsl(var(--lost))", foreground: "hsl(var(--lost-foreground))", chip: "#EA90BD" },
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
      // Lifted off the system's scale after readability complaints from both
      // teams. The system's own sizes "stay small" by design — 12px meta,
      // 14px workhorse — which is too tight for these dense, all-day tools.
      // Every step below 16px gains a point, and the stat figures go back to
      // the size they were before the migration.
      fontSize: {
        "2xs": ["11px", "1.5"],
        xs: ["13px", "1.5"],
        sm: ["15px", "1.5"],
        base: ["16px", "1.5"],
        lg: ["19px", "1.3"],
        xl: ["21px", "1.25"],
        "2xl": ["26px", "1.2"],
        "3xl": ["32px", "1.15"],
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
