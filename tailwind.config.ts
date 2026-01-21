import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        maroon: {
          50: "#fdf2f2",
          100: "#fde8e8",
          200: "#fbd5d5",
          300: "#f8b4b4",
          400: "#f98080",
          500: "#f05252",
          600: "#e02424",
          700: "#c81e1e",
          800: "#9b1c1c",
          900: "#771d1d",
          DEFAULT: "#800000", 
          light: "#a83232",
          dark: "#4d0000",
        },

        primary: {
          DEFAULT: "#800000", 
          foreground: "#ffffff",
          50: "#fdf2f2",
          100: "#fde8e8",
          200: "#fbd5d5",
          300: "#f8b4b4",
          400: "#f98080",
          500: "#f05252",
          600: "#e02424",
          700: "#c81e1e",
          800: "#9b1c1c",
          900: "#771d1d",
        },

        secondary: {
          DEFAULT: "#f5f5f5",
          foreground: "#000000",
        },

        destructive: {
          DEFAULT: "#e02424",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#f5f5f5",
          foreground: "#737373",
        },
        accent: {
          DEFAULT: "#800000",
          foreground: "#ffffff",
        },
        popover: {
          DEFAULT: "#ffffff",
          foreground: "#020817",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#020817",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // --- THE PREMIUM EXTENSIONS ---
      transitionTimingFunction: {
        'expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out forwards",
      },
      backgroundImage: {
        'maroon-gradient': 'linear-gradient(135deg, #800000 0%, #a83232 100%)',
        'maroon-light': 'linear-gradient(135deg, #fdf2f2 0%, #fde8e8 100%)',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;