import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display-xs", "display-sm", "display-md", "display-lg", "display-xl", "display-2xl"],
    },
  },
});

export function cx(...classes: Array<string | false | null | undefined>) {
  return twMerge(classes.filter(Boolean).join(" "));
}

export function sortCx<T extends Record<string, string | number | Record<string, string | number | Record<string, string | number>>>>(classes: T): T {
  return classes;
}
