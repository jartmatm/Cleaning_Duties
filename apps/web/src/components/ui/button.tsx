import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  secondary: "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50",
  ghost: "bg-transparent text-slate-900 hover:bg-slate-100",
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
