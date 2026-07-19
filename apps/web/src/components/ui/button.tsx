import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[var(--company-primary)] text-white hover:brightness-95",
  secondary: "bg-white text-[var(--company-text)] ring-1 ring-[var(--company-border)] hover:bg-[var(--company-surface)]",
  ghost: "bg-transparent text-[var(--company-text)] hover:bg-[var(--company-surface)]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { children, className = "", variant = "primary", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
