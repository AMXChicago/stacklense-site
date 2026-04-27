import type { Config } from "tailwindcss";

/**
 * Design tokens are defined as CSS variables in app/globals.css and
 * exposed to Tailwind here so utilities like `bg-bg`, `text-ink`,
 * `border-border` work. Single source of truth for the palette.
 *
 * The palette ports the existing dark theme from the legacy CSS
 * (--bg, --bg2, --ink, --green, etc.) so the visual identity is
 * preserved across the rebuild.
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces (background layers)
        bg: "var(--bg)",
        bg2: "var(--bg2)",
        bg3: "var(--bg3)",
        // Borders / dividers
        border: "var(--border)",
        border2: "var(--border2)",
        // Foreground (text) layers
        ink: "var(--ink)",
        ink2: "var(--ink2)",
        ink3: "var(--ink3)",
        // Accents
        green: "var(--green)",
        green2: "var(--green2)",
        green3: "var(--green3)",
        amber: "var(--amber)",
        red: "var(--red)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        serif: ["var(--font-serif)", "serif"],
      },
    },
  },
  plugins: [
    // Required by shadcn/ui dialog, popover, tabs, tooltip transitions.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("tailwindcss-animate"),
  ],
};
export default config;
