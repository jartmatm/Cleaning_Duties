import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f6f3ee",
        foreground: "#111827",
      },
    },
  },
  darkMode: ["class"],
} satisfies Config;
